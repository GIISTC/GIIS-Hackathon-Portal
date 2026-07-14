'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Submission, Team, Participant } from '@/lib/types'

const card = 'rounded-card border border-line bg-panel/70 p-6 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'
const sectionNum = 'flex h-7 w-7 items-center justify-center rounded-full border border-brand/40 bg-brand/10 font-mono text-xs font-bold text-brand'

export default function SubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [, setParticipant] = useState<Participant | null>(null)
  const [existing, setExisting] = useState<Submission | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ project_name: '', description: '', github_url: '', drive_url: '', demo_url: '' })
  const [submissionsEnabled, setSubmissionsEnabled] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: settingRow } = await supabase
        .from('system_settings').select('value').eq('key', 'submissions_enabled').maybeSingle()
      setSubmissionsEnabled(settingRow ? settingRow.value === true : false)

      const { data: part } = await supabase.from('participants').select('*, team:teams(*)').eq('id', user.id).single()
      if (!part) { router.push('/login'); return }
      setParticipant(part)
      setTeam(part.team as unknown as Team)

      const { data: sub } = await supabase.from('submissions').select('*').eq('team_id', part.team_id).single()
      if (sub) {
        setExisting(sub)
        setForm({
          project_name: sub.project_name || '', description: sub.description || '',
          github_url: sub.github_url || '', drive_url: sub.drive_url || '', demo_url: sub.demo_url || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [router])

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const validate = (): string | null => {
    if (!form.project_name.trim()) return 'Project name is required.'
    if (!form.description.trim()) return 'Project description is required.'
    if (form.description.trim().length < 50) return 'Description must be at least 50 characters.'
    if (!form.github_url.trim()) return 'GitHub repository URL is required.'
    if (!form.github_url.includes('github.com')) return 'Please enter a valid GitHub URL.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      team_id: team!.id, project_name: form.project_name.trim(), description: form.description.trim(),
      github_url: form.github_url.trim(), drive_url: form.drive_url.trim() || null, demo_url: form.demo_url.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let err2 = null
    if (existing) {
      const { error } = await supabase.from('submissions').update(payload).eq('id', existing.id)
      err2 = error
    } else {
      const { error } = await supabase.from('submissions').insert({ ...payload, submitted_at: new Date().toISOString() })
      err2 = error
    }
    setSaving(false)
    if (err2) setError(err2.message)
    else { setSuccess(true); setTimeout(() => router.push('/dashboard'), 2500) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading…
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center px-4 py-28">
          <div className={`${card} max-w-md text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-brand">Success</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink">Submission {existing ? 'Updated' : 'Received'}</h1>
            <p className="mt-2 text-ink-sub">Your project has been {existing ? 'updated' : 'submitted'} successfully. Redirecting to dashboard…</p>
          </div>
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
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// Project Submission</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">{existing ? 'Update Your Project' : 'Submit Your Project'}</h1>
          <p className="mt-2 text-ink-sub">
            Team: <span className="text-brand">{team?.team_name}</span>
            {existing && ' · You can update your submission any time before the deadline.'}
          </p>
        </div>

        {existing && (
          <div className="mb-4 rounded-lg border border-brand/25 bg-brand/[0.06] px-4 py-3 text-sm text-ink-sub">
            Your team already has a submission. Update it below. Last updated: {new Date(existing.updated_at).toLocaleString()}
          </div>
        )}

        {!submissionsEnabled ? (
          <div className={`${card} flex flex-col items-center gap-4 py-14 text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-warn">Locked</div>
            <h2 className="font-display text-2xl font-bold text-ink">Submissions are Closed</h2>
            <p className="max-w-sm text-ink-sub">The submission window has ended or is not yet open. Contact the organizers if you believe this is an error.</p>
            <Link href="/dashboard" className="rounded-lg border border-line px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-brand hover:bg-brand/5">Return to Dashboard</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className={card}>
              <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold text-ink"><span className={sectionNum}>01</span>Project Identity</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls} htmlFor="project-name">Project Name *</label>
                  <input id="project-name" type="text" className={inputCls} placeholder="What's your project called?" value={form.project_name} onChange={update('project_name')} maxLength={80} required />
                </div>
                <div>
                  <label className={labelCls} htmlFor="description">Project Description *</label>
                  <textarea id="description" className={`${inputCls} min-h-[160px]`} maxLength={2000} required value={form.description} onChange={update('description')}
                    placeholder="What problem does it solve, how does it work, what tech did you use? (minimum 50 characters)" />
                  <span className="mt-1 block text-xs text-ink-dim">{form.description.length}/2000 characters</span>
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold text-ink"><span className={sectionNum}>02</span>Project Links</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls} htmlFor="github">GitHub Repository *</label>
                  <input id="github" type="url" className={inputCls} placeholder="https://github.com/your-team/your-project" value={form.github_url} onChange={update('github_url')} required />
                  <span className="mt-1 block text-xs text-ink-dim">Your main codebase. Must be public or accessible to judges.</span>
                </div>
                <div>
                  <label className={labelCls} htmlFor="drive">Google Drive Link <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                  <input id="drive" type="url" className={inputCls} placeholder="https://drive.google.com/…" value={form.drive_url} onChange={update('drive_url')} />
                  <span className="mt-1 block text-xs text-ink-dim">Slides, design files, additional docs, or assets.</span>
                </div>
                <div>
                  <label className={labelCls} htmlFor="demo">Demo Video URL <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                  <input id="demo" type="url" className={inputCls} placeholder="https://youtube.com/… or a Drive link" value={form.demo_url} onChange={update('demo_url')} />
                  <span className="mt-1 block text-xs text-ink-dim">A short demo or walkthrough of your project.</span>
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold text-ink"><span className={sectionNum}>03</span>Before You Submit</h2>
              <div className="flex flex-col gap-3">
                {[
                  'Your GitHub repository is public and accessible',
                  'The README explains your project clearly',
                  'All team members are listed in your profile',
                  'Your project description is thorough and honest',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-ink-sub">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good/15 text-[0.7rem] text-good">✓</span>{item}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-[#fca5a5]">{error}</div>
            )}

            <button type="submit" disabled={saving}
              className="rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? 'Submitting…' : existing ? 'Update Submission' : 'Submit Project'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
