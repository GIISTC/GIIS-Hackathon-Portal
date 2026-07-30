'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { SideQuest, SideQuestSubmission, QuestDifficulty } from '@/lib/types'
import { DIFFICULTY_LABELS } from '@/lib/types'
import { externalUrl } from '@/lib/url'

type QuestWithSubmission = SideQuest & { mySubmission: SideQuestSubmission | null; hasImages: boolean }
type Pick = { quest_id: string; picked_at: string }

const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'

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
  const [picking, setPicking] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  const [draft, setDraft] = useState({ response_text: '', response_link: '' })
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [images, setImages] = useState<string[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [slide, setSlide] = useState(0)
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)

  const load = async () => {
    const res = await fetch('/api/side-quests')
    if (res.ok) {
      const data: { quests: QuestWithSubmission[]; myPick: Pick | null } = await res.json()
      setQuests(data.quests)
      setMyPick(data.myPick)
      const mine = data.myPick ? data.quests.find((q) => q.id === data.myPick!.quest_id) : null
      if (mine) {
        setDraft({ response_text: mine.mySubmission?.response_text || '', response_link: mine.mySubmission?.response_link || '' })
        if (mine.hasImages) loadImages(mine.id)
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

  const loadImages = async (questId: string) => {
    setImagesLoading(true)
    try {
      const res = await fetch(`/api/side-quests/${questId}/images`)
      const data = await res.json()
      if (res.ok) { setImages(data.urls || []); setSlide(0) }
    } catch {}
    setImagesLoading(false)
  }

  useEffect(() => {
    if (images.length < 2) return
    const id = setInterval(() => setSlide((s) => (s + 1) % images.length), 4000)
    return () => clearInterval(id)
  }, [images])

  const choose = async (questId: string, difficulty: QuestDifficulty) => {
    if (!confirm(`Lock in the ${DIFFICULTY_LABELS[difficulty]} quest? You won't be able to see or attempt any other quest after this — this choice is final.`)) return
    setPicking(questId)
    setPickError(null)
    try {
      const res = await fetch(`/api/side-quests/${questId}/pick`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (err: any) {
      setPickError(err.message || 'Failed to lock in that quest.')
    }
    setPicking(null)
  }

  const submit = async (questId: string) => {
    setSaving(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/side-quests/${questId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, mySubmission: data } : q)))
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit.')
    }
    setSaving(false)
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

  // Group open quests by difficulty for the blind-pick screen — one
  // mystery box per tier. If OT ever opens more than one quest in the
  // same tier at once, the earliest is what gets offered.
  const openByDifficulty = (['beginner', 'intermediate', 'advanced'] as QuestDifficulty[])
    .map((d) => quests.filter((q) => q.difficulty === d && q.status === 'open').sort((a, b) => a.created_at.localeCompare(b.created_at))[0])
    .filter((q): q is QuestWithSubmission => !!q)

  const pickedQuest = myPick ? quests.find((q) => q.id === myPick.quest_id) : null
  const otherTiers = pickedQuest
    ? quests.filter((q) => q.id !== pickedQuest.id && q.difficulty && q.difficulty !== pickedQuest.difficulty)
    : []
  const seenTiers = new Set<QuestDifficulty>()
  const lockedTierCards = otherTiers.filter((q) => {
    if (!q.difficulty || seenTiers.has(q.difficulty)) return false
    seenTiers.add(q.difficulty); return true
  })

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-28">
        <div className="mb-6">
          <Link href="/dashboard" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-dim hover:text-brand">← Back to Dashboard</Link>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// Bonus Challenge</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Side Quest</h1>
          <p className="mt-2 text-ink-sub">
            {pickedQuest
              ? 'Your team has locked in a quest — good luck.'
              : 'Pick a difficulty tier blind. You won’t see what it actually is until you commit, and once you commit every other quest is locked out for your team. Choose wisely.'}
          </p>
        </div>

        {!pickedQuest && openByDifficulty.length === 0 && (
          <div className={`${card} flex flex-col items-center gap-3 py-14 text-center`}>
            <h2 className="font-display text-lg font-bold text-ink">No side quest available yet</h2>
            <p className="text-ink-sub">Check back during the event — OT releases quests throughout the hackathon.</p>
          </div>
        )}

        {!pickedQuest && openByDifficulty.length > 0 && (
          <div className="flex flex-col gap-4">
            {pickError && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{pickError}</div>}
            <div className="grid gap-3 sm:grid-cols-3">
              {openByDifficulty.map((q) => {
                const style = DIFFICULTY_STYLE[q.difficulty as QuestDifficulty]
                return (
                  <div key={q.id} className={`${card} flex h-full flex-col items-center gap-3 text-center`}>
                    <span className={`rounded-full px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide ${style.badge}`}>
                      {DIFFICULTY_LABELS[q.difficulty as QuestDifficulty]}
                    </span>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-line font-display text-2xl text-ink-dim">?</div>
                    <p className="flex min-h-[2.75rem] items-center text-xs leading-snug text-ink-dim">{style.blurb}</p>
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.62rem] font-bold text-brand">+{q.points} pts</span>
                    <button onClick={() => choose(q.id, q.difficulty as QuestDifficulty)} disabled={picking === q.id}
                      className="mt-auto w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue px-3 py-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                      {picking === q.id ? 'Locking in…' : 'Choose Blindly'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {pickedQuest && (
          <div className="flex flex-col gap-4">
            <div className={card}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-ink">{pickedQuest.title}</h3>
                <div className="flex shrink-0 gap-2">
                  {pickedQuest.difficulty && (
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${DIFFICULTY_STYLE[pickedQuest.difficulty].badge}`}>
                      {DIFFICULTY_LABELS[pickedQuest.difficulty]}
                    </span>
                  )}
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.6rem] font-bold text-brand">+{pickedQuest.points} pts</span>
                  <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${pickedQuest.status === 'open' ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}>
                    {pickedQuest.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>
              <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-sub">{pickedQuest.description}</p>

              {pickedQuest.hasImages && (
                <div className="mb-3">
                  {imagesLoading ? (
                    <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
                  ) : images.length > 0 ? (
                    <div className="relative overflow-hidden rounded-lg border border-line bg-base">
                      <a href={images[slide]} target="_blank" rel="noreferrer" className="block aspect-video">
                        <img src={images[slide]} alt="" className="h-full w-full object-contain" />
                      </a>
                      {images.length > 1 && (
                        <>
                          <button onClick={() => setSlide((s) => (s - 1 + images.length) % images.length)} aria-label="Previous image"
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-base/70 px-2.5 py-1.5 text-ink backdrop-blur transition-colors hover:bg-base/90 hover:text-brand">‹</button>
                          <button onClick={() => setSlide((s) => (s + 1) % images.length)} aria-label="Next image"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-base/70 px-2.5 py-1.5 text-ink backdrop-blur transition-colors hover:bg-base/90 hover:text-brand">›</button>
                          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                            {images.map((_, i) => (
                              <button key={i} onClick={() => setSlide(i)} aria-label={`Go to image ${i + 1}`}
                                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === slide ? 'bg-brand' : 'bg-ink-dim/60'}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {pickedQuest.status === 'open' ? (
                <div className="border-t border-line pt-3">
                  <div className="mb-3">
                    <label className={labelCls}>Your Response</label>
                    <textarea className={`${inputCls} min-h-[90px]`} value={draft.response_text}
                      onChange={(e) => setDraft((d) => ({ ...d, response_text: e.target.value }))} placeholder="Write your answer or describe what you did…" />
                  </div>
                  <div>
                    <label className={labelCls}>Link <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                    <input type="url" className={inputCls} value={draft.response_link} onChange={(e) => setDraft((d) => ({ ...d, response_link: e.target.value }))} placeholder="https://…" />
                  </div>
                  {submitError && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{submitError}</div>}
                  <button onClick={() => submit(pickedQuest.id)} disabled={saving}
                    className="mt-3 rounded-lg bg-gradient-to-br from-brand to-brand-blue px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                    {saving ? 'Submitting…' : pickedQuest.mySubmission ? 'Update Submission' : 'Submit Solution'}
                  </button>
                </div>
              ) : (
                <div className="border-t border-line pt-3">
                  {pickedQuest.mySubmission ? (
                    <>
                      <p className="mb-1 text-xs text-ink-dim">Your submitted response:</p>
                      <p className="whitespace-pre-wrap break-words text-sm text-ink-sub">{pickedQuest.mySubmission.response_text}</p>
                      {pickedQuest.mySubmission.response_link && (
                        <a href={externalUrl(pickedQuest.mySubmission.response_link) || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brand hover:underline">View submitted link ↗</a>
                      )}
                      {pickedQuest.mySubmission.verdict === 'pending' && <div className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm text-warn">Awaiting grading</div>}
                      {pickedQuest.mySubmission.verdict === 'correct' && <div className="mt-3 rounded-lg border border-good/30 bg-good/10 px-4 py-2.5 text-sm text-good">✓ Correct — +{pickedQuest.points} pts awarded</div>}
                      {pickedQuest.mySubmission.verdict === 'incorrect' && <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">✗ Incorrect — no points awarded</div>}
                    </>
                  ) : (
                    <p className="text-sm text-ink-dim">Submissions closed. Your team didn&apos;t submit a response for this quest.</p>
                  )}
                </div>
              )}
            </div>

            {lockedTierCards.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-dim">Locked out — your team's one choice was made</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {lockedTierCards.map((q) => (
                    <div key={q.id} className={`${card} flex flex-col items-center gap-1.5 py-4 opacity-50`}>
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase ${DIFFICULTY_STYLE[q.difficulty as QuestDifficulty].badge}`}>
                        {DIFFICULTY_LABELS[q.difficulty as QuestDifficulty]}
                      </span>
                      <span className="font-mono text-lg text-ink-dim">🔒</span>
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
