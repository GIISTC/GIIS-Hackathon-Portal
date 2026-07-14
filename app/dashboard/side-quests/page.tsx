'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { SideQuest, SideQuestSubmission } from '@/lib/types'

type QuestWithSubmission = SideQuest & { mySubmission: SideQuestSubmission | null }

const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'

export default function SideQuestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quests, setQuests] = useState<QuestWithSubmission[]>([])
  const [drafts, setDrafts] = useState<Record<string, { response_text: string; response_link: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/side-quests')
      if (res.ok) {
        const data: QuestWithSubmission[] = await res.json()
        setQuests(data)
        const initial: Record<string, { response_text: string; response_link: string }> = {}
        data.forEach((q) => {
          initial[q.id] = { response_text: q.mySubmission?.response_text || '', response_link: q.mySubmission?.response_link || '' }
        })
        setDrafts(initial)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const updateDraft = (questId: string, field: 'response_text' | 'response_link', value: string) =>
    setDrafts((prev) => ({ ...prev, [questId]: { ...prev[questId], [field]: value } }))

  const submit = async (questId: string) => {
    setSavingId(questId)
    setErrors((prev) => ({ ...prev, [questId]: '' }))
    try {
      const draft = drafts[questId] || { response_text: '', response_link: '' }
      const res = await fetch(`/api/side-quests/${questId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, mySubmission: data } : q)))
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [questId]: err.message || 'Failed to submit.' }))
    }
    setSavingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading side quests…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28">
        <div className="mb-6">
          <Link href="/dashboard" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-dim hover:text-brand">← Back to Dashboard</Link>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// Bonus Challenges</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Side Quests</h1>
          <p className="mt-2 text-ink-sub">Complete these for extra points on top of your project score. Submit while a quest is open — OT grades it once submissions close.</p>
        </div>

        {quests.length === 0 ? (
          <div className={`${card} flex flex-col items-center gap-3 py-14 text-center`}>
            <h2 className="font-display text-lg font-bold text-ink">No side quests yet</h2>
            <p className="text-ink-sub">Check back during the event — OT releases new quests throughout the hackathon.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {quests.map((q) => {
              const draft = drafts[q.id] || { response_text: '', response_link: '' }
              const isOpen = q.status === 'open'
              return (
                <div key={q.id} className={card}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-bold text-ink">{q.title}</h3>
                    <div className="flex shrink-0 gap-2">
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.6rem] font-bold text-brand">+{q.points} pts</span>
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${isOpen ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}>{isOpen ? 'Open' : 'Closed'}</span>
                    </div>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-sub">{q.description}</p>

                  {isOpen ? (
                    <div className="border-t border-line pt-3">
                      <div className="mb-3">
                        <label className={labelCls}>Your Response</label>
                        <textarea className={`${inputCls} min-h-[90px]`} value={draft.response_text}
                          onChange={(e) => updateDraft(q.id, 'response_text', e.target.value)} placeholder="Write your answer or describe what you did…" />
                      </div>
                      <div>
                        <label className={labelCls}>Link <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                        <input type="url" className={inputCls} value={draft.response_link} onChange={(e) => updateDraft(q.id, 'response_link', e.target.value)} placeholder="https://…" />
                      </div>
                      {errors[q.id] && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{errors[q.id]}</div>}
                      <button onClick={() => submit(q.id)} disabled={savingId === q.id}
                        className="mt-3 rounded-lg bg-gradient-to-br from-brand to-brand-blue px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                        {savingId === q.id ? 'Submitting…' : q.mySubmission ? 'Update Submission' : 'Submit Solution'}
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-line pt-3">
                      {q.mySubmission ? (
                        <>
                          <p className="mb-1 text-xs text-ink-dim">Your submitted response:</p>
                          <p className="whitespace-pre-wrap text-sm text-ink-sub">{q.mySubmission.response_text}</p>
                          {q.mySubmission.response_link && (
                            <a href={q.mySubmission.response_link} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brand hover:underline">View submitted link ↗</a>
                          )}
                          {q.mySubmission.verdict === 'pending' && <div className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm text-warn">Awaiting grading</div>}
                          {q.mySubmission.verdict === 'correct' && <div className="mt-3 rounded-lg border border-good/30 bg-good/10 px-4 py-2.5 text-sm text-good">✓ Correct — +{q.points} pts awarded</div>}
                          {q.mySubmission.verdict === 'incorrect' && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">✗ Incorrect — no points awarded</div>}
                        </>
                      ) : (
                        <p className="text-sm text-ink-dim">Submissions closed. Your team didn&apos;t submit a response for this quest.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
