'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { SideQuest, SideQuestSubmission, QuestDifficulty } from '@/lib/types'
import { DIFFICULTY_LABELS } from '@/lib/types'
import { externalUrl } from '@/lib/url'

type QuestWithSubmission = SideQuest & { mySubmission: SideQuestSubmission | null; hasFiles: boolean }
type Pick = { difficulty: QuestDifficulty; picked_at: string }
type QuestFileLink = { path: string; name: string; size: number; url: string }
type Draft = { response_text: string; response_link: string }

const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'

const TIERS: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

const fileExt = (name: string) => {
  const ext = name.includes('.') ? name.split('.').pop()! : ''
  return (ext || 'file').slice(0, 4).toUpperCase()
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DIFFICULTY_STYLE: Record<QuestDifficulty, { badge: string; blurb: string }> = {
  beginner: { badge: 'bg-good/15 text-good', blurb: 'Lower risk — should be approachable for most teams.' },
  intermediate: { badge: 'bg-warn/15 text-warn', blurb: 'Moderate risk — expect a real challenge.' },
  advanced: { badge: 'bg-bad/15 text-bad', blurb: 'High risk — for teams chasing the biggest reward.' },
}

export default function SideQuestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quests, setQuests] = useState<QuestWithSubmission[]>([])
  const [myPick, setMyPick] = useState<Pick | null>(null)
  const [picking, setPicking] = useState<QuestDifficulty | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<Record<string, string>>({})

  const [filesByQuest, setFilesByQuest] = useState<Record<string, QuestFileLink[]>>({})
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)

  const loadFiles = async (questId: string) => {
    try {
      const res = await fetch(`/api/side-quests/${questId}/files`)
      const data = await res.json()
      if (res.ok) setFilesByQuest((prev) => ({ ...prev, [questId]: data.files || [] }))
    } catch {}
  }

  const load = async () => {
    const res = await fetch('/api/side-quests')
    if (res.ok) {
      const data: { quests: QuestWithSubmission[]; myPick: Pick | null } = await res.json()
      setQuests(data.quests)
      setMyPick(data.myPick)

      if (data.myPick) {
        const mine = data.quests.filter((q) => q.difficulty === data.myPick!.difficulty)
        // Seed a draft per quest, without clobbering anything already typed.
        setDrafts((prev) => {
          const next = { ...prev }
          for (const q of mine) {
            if (next[q.id]) continue
            next[q.id] = {
              response_text: q.mySubmission?.response_text || '',
              response_link: q.mySubmission?.response_link || '',
            }
          }
          return next
        })
        mine.filter((q) => q.hasFiles).forEach((q) => loadFiles(q.id))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: part } = await supabase.from('participants').select('approval_status').eq('id', user.id).single()
      setApprovalStatus(part?.approval_status ?? null)
      if (part?.approval_status !== 'approved') { setLoading(false); return }
      await load()
    }
    init()
  }, [router])

  const choose = async (difficulty: QuestDifficulty, questCount: number) => {
    const label = DIFFICULTY_LABELS[difficulty]
    if (!confirm(
      `Lock in the ${label} tier? You'll unlock all ${questCount} quest${questCount > 1 ? 's' : ''} in it, and you won't be able to see or attempt any other tier. This choice is final.`,
    )) return
    setPicking(difficulty)
    setPickError(null)
    try {
      const res = await fetch('/api/side-quests/pick', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (err: any) {
      setPickError(err.message || 'Failed to lock in that tier.')
    }
    setPicking(null)
  }

  const submit = async (questId: string) => {
    setSavingId(questId)
    setSubmitError((prev) => ({ ...prev, [questId]: '' }))
    try {
      const res = await fetch(`/api/side-quests/${questId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drafts[questId] || { response_text: '', response_link: '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, mySubmission: data } : q)))
    } catch (err: any) {
      setSubmitError((prev) => ({ ...prev, [questId]: err.message || 'Failed to submit.' }))
    }
    setSavingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading side quests…
        </div>
      </div>
    )
  }

  if (approvalStatus && approvalStatus !== 'approved') {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-[100dvh] items-center justify-center px-4 py-28">
          <div className={`${card} max-w-md text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-warn">Pending Approval</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink">Not Yet</h1>
            <p className="mt-2 text-ink-sub">Your registration needs OT approval before your team can pick a side quest.</p>
            <Link href="/dashboard" className="mt-5 inline-block rounded-lg border border-line px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-brand hover:bg-brand/5">Return to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  // Blind pick is per tier now: one mystery card per difficulty that has at
  // least one open quest. The quests themselves stay hidden, but the count
  // and the points on the table are shown so the gamble is an informed one.
  const openTiers = TIERS
    .map((d) => {
      const inTier = quests.filter((q) => q.difficulty === d && q.status === 'open')
      return { difficulty: d, count: inTier.length, points: inTier.reduce((sum, q) => sum + (q.points || 0), 0) }
    })
    .filter((t) => t.count > 0)

  // Everything in the tier the team locked in — not just a single quest.
  const myQuests = myPick
    ? quests
        .filter((q) => q.difficulty === myPick.difficulty)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : []

  const lockedTiers = myPick
    ? TIERS.filter((d) => d !== myPick.difficulty && quests.some((q) => q.difficulty === d))
    : []
  const earned = myQuests.filter((q) => q.mySubmission?.verdict === 'correct').reduce((s, q) => s + (q.points || 0), 0)
  const totalOnOffer = myQuests.reduce((s, q) => s + (q.points || 0), 0)

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28">
        <div className="mb-6">
          <Link href="/dashboard" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-dim hover:text-brand">← Back to Dashboard</Link>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// Bonus Challenge</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Side Quests</h1>
          <p className="mt-2 text-ink-sub">
            {myPick
              ? `Your team locked in the ${DIFFICULTY_LABELS[myPick.difficulty]} tier. Every quest in it is below — attempt as many as you like.`
              : 'Pick a difficulty tier blind. You won’t see the quests until you commit, and once you commit every other tier is locked out for your team. Choose wisely.'}
          </p>
        </div>

        {!myPick && openTiers.length === 0 && (
          <div className={`${card} flex flex-col items-center gap-3 py-14 text-center`}>
            <h2 className="font-display text-lg font-bold text-ink">No side quests available yet</h2>
            <p className="text-ink-sub">Check back during the event — OT releases quests throughout the hackathon.</p>
          </div>
        )}

        {!myPick && openTiers.length > 0 && (
          <div className="flex flex-col gap-4">
            {pickError && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{pickError}</div>}
            <div className="grid gap-3 sm:grid-cols-3">
              {openTiers.map((t) => {
                const style = DIFFICULTY_STYLE[t.difficulty]
                return (
                  <div key={t.difficulty} className={`${card} flex h-full flex-col items-center gap-3 text-center`}>
                    <span className={`rounded-full px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide ${style.badge}`}>
                      {DIFFICULTY_LABELS[t.difficulty]}
                    </span>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line font-display text-2xl text-ink-dim">?</div>
                    <p className="flex min-h-[2.75rem] items-center text-xs leading-snug text-ink-dim">{style.blurb}</p>
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-sub">
                        {t.count} quest{t.count > 1 ? 's' : ''}
                      </span>
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.62rem] font-bold text-brand">up to +{t.points} pts</span>
                    </div>
                    <button onClick={() => choose(t.difficulty, t.count)} disabled={picking !== null}
                      className="mt-auto w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue px-3 py-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                      {picking === t.difficulty ? 'Locking in…' : 'Choose Blindly'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {myPick && (
          <div className="flex flex-col gap-4">
            <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <span className={`rounded-full px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide ${DIFFICULTY_STYLE[myPick.difficulty].badge}`}>
                  {DIFFICULTY_LABELS[myPick.difficulty]} Tier
                </span>
                <p className="mt-2 text-sm text-ink-sub">
                  {myQuests.length} quest{myQuests.length === 1 ? '' : 's'} unlocked
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-brand">
                  {earned}<span className="text-sm font-normal text-ink-dim"> / {totalOnOffer} pts</span>
                </div>
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-dim">Earned so far</p>
              </div>
            </div>

            {myQuests.length === 0 && (
              <div className={`${card} py-10 text-center text-sm text-ink-dim`}>
                No quests in this tier are visible yet. Check back shortly.
              </div>
            )}

            {myQuests.map((q, i) => {
              const files = filesByQuest[q.id] || []
              const draft = drafts[q.id] || { response_text: '', response_link: '' }
              return (
                <div key={q.id} className={card}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ink-dim">Quest {i + 1} of {myQuests.length}</span>
                      <h3 className="font-display text-lg font-bold text-ink">{q.title}</h3>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.6rem] font-bold text-brand">+{q.points} pts</span>
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${q.status === 'open' ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}>
                        {q.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-sub">{q.description}</p>

                  {q.hasFiles && (
                    <div className="mb-4">
                      <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand">Quest Files</p>
                      {files.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {files.map((f) => (
                            <a key={f.path} href={f.url} download={f.name}
                              className="group flex items-center gap-3 rounded-lg border border-line bg-base/40 px-3 py-2.5 transition-colors hover:border-brand/50 hover:bg-brand/[0.04]">
                              <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded border border-line bg-panel/60 font-mono text-[0.55rem] font-bold uppercase text-brand">
                                {fileExt(f.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                                <span className="block font-mono text-[0.6rem] text-ink-dim">{formatBytes(f.size)}</span>
                              </span>
                              <span className="shrink-0 rounded-lg border border-brand/40 px-3 py-1.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-brand transition-colors group-hover:bg-brand group-hover:text-base">
                                Download
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="flex justify-center py-3"><div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
                      )}
                    </div>
                  )}

                  {q.status === 'open' ? (
                    <div className="border-t border-line pt-3">
                      <div className="mb-3">
                        <label className={labelCls}>Your Response</label>
                        <textarea className={`${inputCls} min-h-[90px]`} value={draft.response_text}
                          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: { ...draft, response_text: e.target.value } }))}
                          placeholder="Write your answer or describe what you did…" />
                      </div>
                      <div>
                        <label className={labelCls}>Link <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                        <input type="url" className={inputCls} value={draft.response_link}
                          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: { ...draft, response_link: e.target.value } }))}
                          placeholder="https://…" />
                      </div>
                      {submitError[q.id] && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{submitError[q.id]}</div>}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button onClick={() => submit(q.id)} disabled={savingId === q.id}
                          className="rounded-lg bg-gradient-to-br from-brand to-brand-blue px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                          {savingId === q.id ? 'Submitting…' : q.mySubmission ? 'Update Submission' : 'Submit Solution'}
                        </button>
                        {q.mySubmission?.verdict === 'pending' && <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-warn">Awaiting grading</span>}
                        {q.mySubmission?.verdict === 'correct' && <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-good">✓ Correct — +{q.points} pts</span>}
                        {q.mySubmission?.verdict === 'incorrect' && <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-bad">✗ Incorrect</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-line pt-3">
                      {q.mySubmission ? (
                        <>
                          <p className="mb-1 text-xs text-ink-dim">Your submitted response:</p>
                          <p className="whitespace-pre-wrap break-words text-sm text-ink-sub">{q.mySubmission.response_text}</p>
                          {q.mySubmission.response_link && (
                            <a href={externalUrl(q.mySubmission.response_link) || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brand hover:underline">View submitted link ↗</a>
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

            {lockedTiers.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-dim">Locked out — your team&apos;s one choice was made</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {lockedTiers.map((d) => (
                    <div key={d} className={`${card} flex items-center gap-3 opacity-60`}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line font-display text-lg text-ink-dim">?</div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${DIFFICULTY_STYLE[d].badge}`}>
                          {DIFFICULTY_LABELS[d]}
                        </span>
                        <p className="mt-1 text-xs text-ink-dim">Never revealed</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
