'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import type { SideQuest, SideQuestSubmission, QuestDifficulty } from '@/lib/types'
import { DIFFICULTY_LABELS } from '@/lib/types'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'
const smBtn = 'rounded-lg px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] transition-colors'

const DIFFICULTIES: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

export default function SideQuestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [isOT, setIsOT] = useState(false)

  const [quests, setQuests] = useState<SideQuest[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', points: 10, difficulty: 'beginner' as QuestDifficulty })
  const [files, setFiles] = useState<File[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<SideQuestSubmission[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [galleryQuestId, setGalleryQuestId] = useState<string | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<{ path: string; url: string }[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      setIsOT(judge.role === 'ot')
      if (judge.role === 'ot') await loadQuests()
      setLoading(false)
    }
    init()
  }, [router])

  const loadQuests = async () => {
    const res = await fetch('/api/admin/side-quests')
    const data = await res.json()
    if (res.ok) setQuests(data)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.description.trim() || form.points <= 0) {
      setError('Title, description, and a positive points value are required.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/side-quests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (files.length > 0) {
        const fd = new FormData()
        files.forEach((f) => fd.append('images', f))
        const imgRes = await fetch(`/api/admin/side-quests/${data.id}/images`, { method: 'POST', body: fd })
        if (!imgRes.ok) {
          const imgData = await imgRes.json()
          throw new Error(`Quest created, but image upload failed: ${imgData.error}`)
        }
      }

      setForm({ title: '', description: '', points: 10, difficulty: 'beginner' })
      setFiles([])
      setShowCreate(false)
      await loadQuests()
    } catch (err: any) {
      setError(err.message || 'Failed to create quest.')
    }
    setCreating(false)
  }

  const updateStatus = async (id: string, status: 'open' | 'closed') => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/side-quests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      await loadQuests()
    } catch (err: any) {
      alert(err.message || 'Failed to update quest.')
    }
    setActionLoading(null)
  }

  const deleteQuest = async (id: string, status: string) => {
    const warning = status === 'draft'
      ? 'Delete this draft quest? This cannot be undone.'
      : 'This quest has been released — deleting it also wipes any team picks and submissions tied to it. This cannot be undone. Continue?'
    if (!confirm(warning)) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/side-quests/${id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      if (selectedQuestId === id) setSelectedQuestId(null)
      if (galleryQuestId === id) setGalleryQuestId(null)
      await loadQuests()
    } catch (err: any) {
      alert(err.message || 'Failed to delete quest.')
    }
    setActionLoading(null)
  }

  const viewSubmissions = async (id: string) => {
    setSelectedQuestId(id)
    setSubsLoading(true)
    try {
      const res = await fetch(`/api/admin/side-quests/${id}/submissions`)
      const data = await res.json()
      if (res.ok) setSubmissions(data)
    } catch {}
    setSubsLoading(false)
  }

  const grade = async (submissionId: string, verdict: 'correct' | 'incorrect') => {
    if (!selectedQuestId) return
    setGradingId(submissionId)
    try {
      const res = await fetch(`/api/admin/side-quests/${selectedQuestId}/submissions/${submissionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verdict }),
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      await viewSubmissions(selectedQuestId)
    } catch (err: any) {
      alert(err.message || 'Failed to grade submission.')
    }
    setGradingId(null)
  }

  const fetchGallery = async (id: string) => {
    setGalleryLoading(true)
    try {
      const res = await fetch(`/api/side-quests/${id}/images`)
      const data = await res.json()
      const quest = quests.find((q) => q.id === id)
      const paths = quest?.image_paths || []
      if (res.ok) setGalleryUrls(paths.map((p, i) => ({ path: p, url: data.urls[i] })))
    } catch {}
    setGalleryLoading(false)
  }

  const toggleGallery = async (id: string) => {
    if (galleryQuestId === id) { setGalleryQuestId(null); return }
    setGalleryQuestId(id)
    setGalleryUrls([])
    await fetchGallery(id)
  }

  const uploadMoreImages = async (id: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploadingFor(id)
    try {
      const fd = new FormData()
      Array.from(fileList).forEach((f) => fd.append('images', f))
      const res = await fetch(`/api/admin/side-quests/${id}/images`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadQuests()
      await fetchGallery(id)
    } catch (err: any) {
      alert(err.message || 'Failed to upload images.')
    }
    setUploadingFor(null)
  }

  const deleteImage = async (questId: string, path: string) => {
    if (!confirm('Remove this image from the quest?')) return
    try {
      const res = await fetch(`/api/admin/side-quests/${questId}/images`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadQuests()
      setGalleryUrls((prev) => prev.filter((g) => g.path !== path))
    } catch (err: any) {
      alert(err.message || 'Failed to remove image.')
    }
  }

  const selectedQuest = quests.find((q) => q.id === selectedQuestId)

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: 'bg-good/15 text-good', closed: 'bg-bad/15 text-bad', draft: 'bg-warn/15 text-warn',
    }
    return <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-wide ${map[s]}`}>{s}</span>
  }

  const difficultyBadge = (d: QuestDifficulty | null | undefined) => {
    if (!d) return null
    const map: Record<QuestDifficulty, string> = {
      beginner: 'bg-good/15 text-good', intermediate: 'bg-warn/15 text-warn', advanced: 'bg-bad/15 text-bad',
    }
    return <span className={`rounded-full px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-wide ${map[d]}`}>{DIFFICULTY_LABELS[d]}</span>
  }

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="sidequests" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading…
          </div>
        </main>
      </div>
    )
  }

  if (!isOT) {
    return (
      <div className={shell}>
        <AdminNav active="sidequests" adminName={adminName} />
        <main className={main}>
          <div className={`${card} flex flex-col items-center gap-3 py-16 text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-warn">Restricted</div>
            <h2 className="font-display text-xl font-bold text-ink">OT Access Only</h2>
            <p className="max-w-md text-ink-sub">Side Quest management is restricted to OT (Organizing Team) members.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="sidequests" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Side Quests</h1>
            <p className="text-sm text-ink-sub">Release blind-pick challenges — teams choose a difficulty tier without seeing its content</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="rounded-lg bg-gradient-to-br from-brand to-brand-blue px-4 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90">
            {showCreate ? '✕ Cancel' : '+ New Quest'}
          </button>
        </div>

        {showCreate && (
          <div className={`${card} mb-6 max-w-xl`}>
            <h2 className="mb-4 font-display text-base font-bold text-ink">Create a Side Quest</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>Difficulty Tier</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, difficulty: d }))}
                      className={`flex-1 rounded-lg border px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                        form.difficulty === d ? 'border-brand bg-brand/10 text-brand' : 'border-line text-ink-sub hover:border-line-soft'
                      }`}>
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-dim">Participants see this tier before picking — everything below stays hidden until they commit.</p>
              </div>
              <div>
                <label className={labelCls}>Title <span className="text-ink-dim normal-case tracking-normal">(hidden until picked)</span></label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Output Prediction" />
              </div>
              <div>
                <label className={labelCls}>Task Description / Material <span className="text-ink-dim normal-case tracking-normal">(hidden until picked)</span></label>
                <textarea className={`${inputCls} min-h-[100px]`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What should teams do? Include any code snippet, prompt, or instructions here." />
              </div>
              <div>
                <label className={labelCls}>Images <span className="text-ink-dim normal-case tracking-normal">(optional, hidden until picked)</span></label>
                <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="w-full rounded-lg border border-dashed border-line bg-panel/40 px-3 py-2.5 text-sm text-ink-sub file:mr-3 file:rounded-md file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-mono file:text-[0.62rem] file:font-bold file:uppercase file:text-brand" />
                {files.length > 0 && <p className="mt-1.5 text-xs text-ink-dim">{files.length} image{files.length > 1 ? 's' : ''} selected</p>}
              </div>
              <div>
                <label className={labelCls}>Points</label>
                <input type="text" inputMode="numeric" className={inputCls} value={form.points || ''}
                  onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 }))} placeholder="10" />
              </div>
              {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{error}</div>}
              <button type="submit" disabled={creating}
                className="rounded-lg bg-gradient-to-br from-brand to-brand-blue py-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Quest (starts as Draft)'}
              </button>
            </form>
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quests.map((q) => (
            <div key={q.id} className={`${card} flex flex-col gap-2.5`}>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {statusBadge(q.status)}
                  {difficultyBadge(q.difficulty)}
                </div>
                <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.6rem] font-bold text-brand">+{q.points} pts</span>
              </div>
              <h3 className="font-display text-base font-bold text-ink">{q.title}</h3>
              <p className="flex-1 whitespace-pre-wrap text-sm text-ink-sub">{q.description}</p>
              {(q.image_paths?.length ?? 0) > 0 && (
                <p className="text-xs text-ink-dim">🖼 {q.image_paths!.length} image{q.image_paths!.length > 1 ? 's' : ''}</p>
              )}

              <div className="mt-auto flex flex-wrap gap-2">
                {q.status === 'draft' && (
                  <button onClick={() => updateStatus(q.id, 'open')} disabled={actionLoading === q.id} className={`${smBtn} bg-gradient-to-br from-brand to-brand-blue text-base`}>Release</button>
                )}
                {q.status === 'open' && (
                  <button onClick={() => updateStatus(q.id, 'closed')} disabled={actionLoading === q.id} className={`${smBtn} border border-line text-brand hover:bg-brand/5`}>Close Submissions</button>
                )}
                <button onClick={() => deleteQuest(q.id, q.status)} disabled={actionLoading === q.id} className={`${smBtn} border border-line text-ink-sub hover:text-bad`}>Delete</button>
                <button onClick={() => toggleGallery(q.id)} className={`${smBtn} text-ink-dim hover:text-ink`}>{galleryQuestId === q.id ? 'Hide Images' : 'Manage Images'}</button>
                <button onClick={() => viewSubmissions(q.id)} className={`${smBtn} text-ink-dim hover:text-ink`}>View Submissions</button>
              </div>

              {galleryQuestId === q.id && (
                <div className="mt-2 border-t border-dashed border-line pt-3">
                  {galleryLoading ? (
                    <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
                  ) : (
                    <div className="mb-2 grid grid-cols-3 gap-2">
                      {galleryUrls.map((g) => (
                        <div key={g.path} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
                          <img src={g.url} alt="" className="h-full w-full object-cover" />
                          <button onClick={() => deleteImage(q.id, g.path)}
                            className="absolute right-1 top-1 rounded-full bg-base/80 px-1.5 py-0.5 text-xs text-bad opacity-0 transition-opacity group-hover:opacity-100">✕</button>
                        </div>
                      ))}
                      {galleryUrls.length === 0 && <p className="col-span-3 text-xs text-ink-dim">No images yet.</p>}
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1 block font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink-dim">Add more</span>
                    <input type="file" accept="image/*" multiple disabled={uploadingFor === q.id}
                      onChange={(e) => uploadMoreImages(q.id, e.target.files)}
                      className="w-full text-xs text-ink-sub file:mr-2 file:rounded-md file:border-0 file:bg-brand/15 file:px-2.5 file:py-1 file:font-mono file:text-[0.6rem] file:font-bold file:uppercase file:text-brand" />
                  </label>
                </div>
              )}
            </div>
          ))}
          {quests.length === 0 && <p className="text-sm text-ink-dim">No side quests yet. Create one to get started.</p>}
        </div>

        {selectedQuest && (
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Submissions — {selectedQuest.title}</h2>
              <button onClick={() => setSelectedQuestId(null)} className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-dim hover:text-ink">✕ Close</button>
            </div>
            {subsLoading ? (
              <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Team', 'Response', 'Link', 'Verdict', 'Grade'].map((h) => (
                        <th key={h} className="px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-dim">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} className="border-b border-line-soft align-top last:border-0">
                        <td className="px-3 py-3 font-semibold text-ink">{(s as any).team?.team_name}</td>
                        <td className="max-w-xs whitespace-pre-wrap px-3 py-3 text-sm text-ink-sub">{s.response_text}</td>
                        <td className="px-3 py-3">
                          {s.response_link ? <a href={s.response_link} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2.5 py-1 font-mono text-[0.6rem] uppercase text-brand hover:bg-brand/5">Link ↗</a> : '–'}
                        </td>
                        <td className="px-3 py-3">{statusBadge(s.verdict)}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1.5">
                            <button disabled={gradingId === s.id} onClick={() => grade(s.id, 'correct')} className="rounded-md border border-good/40 px-2.5 py-1 text-good transition-colors hover:bg-good/10">✓</button>
                            <button disabled={gradingId === s.id} onClick={() => grade(s.id, 'incorrect')} className="rounded-md border border-bad/40 px-2.5 py-1 text-bad transition-colors hover:bg-bad/10">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {submissions.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-ink-dim">No submissions yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
