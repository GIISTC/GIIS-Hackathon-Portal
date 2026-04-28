'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Submission, Team, Participant } from '@/lib/types'
import styles from './page.module.css'

export default function SubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [existing, setExisting] = useState<Submission | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    project_name: '',
    description: '',
    github_url: '',
    drive_url: '',
    demo_url: '',
  })

  const [submissionsEnabled, setSubmissionsEnabled] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check global settings - default to LOCKED if check fails
      const { data: settingRow, error: settingError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'submissions_enabled')
        .maybeSingle()
      
      console.log('Submission Check:', settingRow) // Help debug if it fails
      
      if (settingRow) {
        setSubmissionsEnabled(settingRow.value === true)
      } else {
        // If row is missing, assume locked for safety
        setSubmissionsEnabled(false)
      }

      const { data: part } = await supabase
        .from('participants')
        .select('*, team:teams(*)')
        .eq('id', user.id)
        .single()

      if (!part) { router.push('/login'); return }
      setParticipant(part)
      setTeam(part.team as unknown as Team)

      // Check for existing submission
      const { data: sub } = await supabase
        .from('submissions')
        .select('*')
        .eq('team_id', part.team_id)
        .single()

      if (sub) {
        setExisting(sub)
        setForm({
          project_name: sub.project_name || '',
          description: sub.description || '',
          github_url: sub.github_url || '',
          drive_url: sub.drive_url || '',
          demo_url: sub.demo_url || '',
        })
      }

      setLoading(false)
    }
    load()
  }, [router])

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

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
      team_id: team!.id,
      project_name: form.project_name.trim(),
      description: form.description.trim(),
      github_url: form.github_url.trim(),
      drive_url: form.drive_url.trim() || null,
      demo_url: form.demo_url.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let err2 = null
    if (existing) {
      const { error } = await supabase
        .from('submissions')
        .update(payload)
        .eq('id', existing.id)
      err2 = error
    } else {
      const { error } = await supabase
        .from('submissions')
        .insert({ ...payload, submitted_at: new Date().toISOString() })
      err2 = error
    }

    setSaving(false)
    if (err2) {
      setError(err2.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className={styles.wrapper}>
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        </div>
      </>
    )
  }

  if (success) {
    return (
      <>
        <Navbar />
        <div className={styles.wrapper}>
          <div className={`card ${styles.successCard}`}>
            <div className={styles.successIcon}>🚀</div>
            <h2>Submission {existing ? 'Updated' : 'Received'}!</h2>
            <p>Your project has been {existing ? 'updated' : 'submitted'} successfully. Redirecting to dashboard...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <div className={styles.header}>
            <Link href="/dashboard" className={styles.backLink}>← Back to Dashboard</Link>
            <p className="section-label">Project Submission</p>
            <h1 className={styles.title}>
              {existing ? 'Update Your' : 'Submit Your'} <span className="gradient-text">Project</span>
            </h1>
            <p className={styles.subtitle}>
              Team: <span className="text-accent">{team?.team_name}</span>
              {existing && ' · You can update your submission at any time before the deadline.'}
            </p>
          </div>

          {existing && (
            <div className="alert alert-info" style={{ marginBottom: 'var(--space-3)' }}>
              <span>ℹ️</span>
              <span>
                Your team already has a submission. Fill in the form below to update it.
                Last updated: {new Date(existing.updated_at).toLocaleString()}
              </span>
            </div>
          )}

          {!submissionsEnabled ? (
            <div className={`card ${styles.lockedCard}`}>
              <div className={styles.lockedIcon}>🔒</div>
              <h2 className={styles.lockedTitle}>Submissions are Closed</h2>
              <p className={styles.lockedSub}>
                The submission window has either ended or is not yet open. 
                Please contact the organizers if you believe this is an error.
              </p>
              <Link href="/dashboard" className="btn btn-outline">Return to Dashboard</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
            {/* Project Basics */}
            <div className={`card ${styles.formSection}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>01</span>
                Project Identity
              </h3>

              <div className="form-group">
                <label className="form-label" htmlFor="project-name">Project Name *</label>
                <input
                  id="project-name"
                  type="text"
                  className="form-control"
                  placeholder="What's your project called?"
                  value={form.project_name}
                  onChange={update('project_name')}
                  maxLength={80}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="description">Project Description *</label>
                <textarea
                  id="description"
                  className="form-control"
                  style={{ minHeight: '160px' }}
                  placeholder="Describe your project: what problem does it solve, how does it work, what tech did you use? (minimum 50 characters)"
                  value={form.description}
                  onChange={update('description')}
                  maxLength={2000}
                  required
                />
                <span className="form-hint">{form.description.length}/2000 characters</span>
              </div>
            </div>

            {/* Links */}
            <div className={`card ${styles.formSection}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>02</span>
                Project Links
              </h3>

              <div className="form-group">
                <label className="form-label" htmlFor="github">
                  GitHub Repository <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  id="github"
                  type="url"
                  className="form-control"
                  placeholder="https://github.com/your-team/your-project"
                  value={form.github_url}
                  onChange={update('github_url')}
                  required
                />
                <span className="form-hint">Your main codebase repository. Must be public or accessible to judges.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="drive">
                  Google Drive Link <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  id="drive"
                  type="url"
                  className="form-control"
                  placeholder="https://drive.google.com/..."
                  value={form.drive_url}
                  onChange={update('drive_url')}
                />
                <span className="form-hint">Slides, design files, additional docs, or assets.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="demo">
                  Demo Video URL <span className="form-label-optional">(optional)</span>
                </label>
                <input
                  id="demo"
                  type="url"
                  className="form-control"
                  placeholder="https://youtube.com/... or https://drive.google.com/..."
                  value={form.demo_url}
                  onChange={update('demo_url')}
                />
                <span className="form-hint">A short demo or walkthrough of your project.</span>
              </div>
            </div>

            {/* Checklist */}
            <div className={`card ${styles.formSection} ${styles.checklist}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>03</span>
                Before You Submit
              </h3>
              <div className={styles.checklistItems}>
                {[
                  'Your GitHub repository is public and accessible',
                  'The README explains your project clearly',
                  'All team members are listed in your profile',
                  'Your project description is thorough and honest',
                ].map((item) => (
                  <div key={item} className={styles.checklistItem}>
                    <span className={styles.checkIcon}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary btn-lg btn-full ${saving ? 'btn-loading' : ''}`}
              disabled={saving}
            >
              {saving ? 'Submitting...' : existing ? '✏️ Update Submission' : '🚀 Submit Project'}
            </button>
          </form>
          )}
        </div>
      </div>
    </>
  )
}
