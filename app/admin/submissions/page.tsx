'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { externalUrl } from '@/lib/url'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const linkBtn = 'rounded-md border border-line px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5'
const smBtn = 'rounded-lg px-2.5 py-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] transition-colors'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'

type EditDraft = { project_name: string; description: string; github_url: string; drive_url: string; demo_url: string }

export default function AdminSubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft>({ project_name: '', description: '', github_url: '', drive_url: '', demo_url: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const supabase = createClient()
    const { data: subData } = await supabase
      .from('submissions').select('*, team:teams(team_name)').order('submitted_at', { ascending: false })
    setSubmissions(subData || [])
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      await load()
      setLoading(false)
    }
    init()
  }, [router])

  const startEdit = (s: any) => {
    setEditingId(s.id)
    setError(null)
    setDraft({
      project_name: s.project_name, description: s.description,
      github_url: s.github_url, drive_url: s.drive_url || '', demo_url: s.demo_url || '',
    })
  }

  const saveEdit = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditingId(null)
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.')
    }
    setBusy(null)
  }

  const deleteSubmission = async (id: string, projectName: string) => {
    if (!confirm(`Delete the submission "${projectName}"? This cannot be undone.`)) return
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to delete submission.')
    }
    setBusy(null)
  }

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="submissions" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading submissions…
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="submissions" adminName={adminName} />
      <main className={main}>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Project Submissions</h1>
          <p className="text-sm text-ink-sub">Browse, edit, or delete any team's submission</p>
        </div>

        <div className="flex flex-col gap-3">
          {submissions.map((s) => (
            <div key={s.id} className={card}>
              {editingId === s.id ? (
                <div className="flex flex-col gap-3">
                  <h3 className="font-display text-base font-bold text-ink">Editing — {s.team?.team_name}</h3>
                  <div>
                    <label className={labelCls}>Project Name</label>
                    <input className={inputCls} value={draft.project_name} onChange={(e) => setDraft((d) => ({ ...d, project_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea className={`${inputCls} min-h-[90px]`} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelCls}>GitHub URL</label>
                      <input className={inputCls} value={draft.github_url} onChange={(e) => setDraft((d) => ({ ...d, github_url: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Drive URL</label>
                      <input className={inputCls} value={draft.drive_url} onChange={(e) => setDraft((d) => ({ ...d, drive_url: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Demo URL</label>
                      <input className={inputCls} value={draft.demo_url} onChange={(e) => setDraft((d) => ({ ...d, demo_url: e.target.value }))} />
                    </div>
                  </div>
                  {error && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{error}</div>}
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s.id)} disabled={busy === s.id} className={`${smBtn} bg-gradient-to-br from-brand to-brand-blue px-4 py-2 text-base`}>{busy === s.id ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditingId(null)} className={`${smBtn} border border-line px-4 py-2 text-ink-dim`}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">{s.team?.team_name}</div>
                    <h3 className="mt-0.5 font-display text-base font-bold text-ink">{s.project_name}</h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-sub">{s.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {externalUrl(s.github_url) && <a href={externalUrl(s.github_url)!} target="_blank" rel="noreferrer" className={linkBtn}>GitHub</a>}
                      {externalUrl(s.drive_url) && <a href={externalUrl(s.drive_url)!} target="_blank" rel="noreferrer" className={linkBtn}>Drive</a>}
                      {externalUrl(s.demo_url) && <a href={externalUrl(s.demo_url)!} target="_blank" rel="noreferrer" className={linkBtn}>Demo</a>}
                    </div>
                    <p className="mt-2 text-xs text-ink-dim">Submitted {new Date(s.submitted_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => startEdit(s)} className={`${smBtn} border border-line text-ink-sub hover:text-ink`}>Edit</button>
                    <button onClick={() => deleteSubmission(s.id, s.project_name)} disabled={busy === s.id} className={`${smBtn} border border-bad/40 text-bad hover:bg-bad/10`}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {submissions.length === 0 && <p className={`${card} text-center text-sm text-ink-dim`}>No submissions yet</p>}
        </div>
      </main>
    </div>
  )
}
