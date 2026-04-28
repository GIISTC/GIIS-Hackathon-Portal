'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import styles from './page.module.css'

const GRADES = [
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
  'Grade 10', 'Grade 11', 'Grade 12',
]

interface Member {
  full_name: string
  email: string
  grade: string
  password: string
}

const emptyMember = (): Member => ({ full_name: '', email: '', grade: '', password: '' })

function generateTeamCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generateQrToken(): string {
  return crypto.randomUUID()
}

export default function RegisterPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [teamName, setTeamName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [memberCount, setMemberCount] = useState(1)
  const [members, setMembers] = useState<Member[]>([emptyMember()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successTeam, setSuccessTeam] = useState('')
  const [successCode, setSuccessCode] = useState('')

  const updateMember = (index: number, field: keyof Member, value: string) => {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const updateMemberCount = (n: number) => {
    if (mode === 'join') return // Only 1 member joins at a time
    setMemberCount(n)
    setMembers(prev => {
      const next = [...prev]
      while (next.length < n) next.push(emptyMember())
      return next.slice(0, n)
    })
  }

  const validate = (): string | null => {
    if (mode === 'create' && !teamName.trim()) return 'Team name is required.'
    if (mode === 'create' && teamName.trim().length < 3) return 'Team name must be at least 3 characters.'
    for (let i = 0; i < memberCount; i++) {
      const m = members[i]
      if (!m.full_name.trim()) return `Member ${i + 1}: Full name is required.`
      if (!m.email.trim() || !m.email.includes('@')) return `Member ${i + 1}: Valid email is required.`
      if (!m.grade) return `Member ${i + 1}: Grade is required.`
      if (!m.password || m.password.length < 8) return `Member ${i + 1}: Password must be at least 8 characters.`
    }
    const emails = members.slice(0, memberCount).map(m => m.email.toLowerCase())
    if (new Set(emails).size !== emails.length) return 'All members must have unique email addresses.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const activeMembers = members.slice(0, memberCount)
    let finalTeamId = ''
    let finalTeamName = ''

    try {
      // 0. Pre-check if any emails are already registered
      const emails = activeMembers.map(m => m.email.trim().toLowerCase())
      const { data: existingEmails, error: checkError } = await supabase
        .rpc('check_existing_emails', { emails_to_check: emails })

      if (checkError) throw new Error("Could not verify emails. Please try again.")
      
      if (existingEmails && existingEmails.length > 0) {
        throw new Error(`Email ${existingEmails.join(', ')} is already registered! Sign in instead!`)
      }

      if (mode === 'create') {
        const teamCode = generateTeamCode()
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .insert({ team_name: teamName.trim(), team_code: teamCode })
          .select()
          .single()

        if (teamError) {
          if (teamError.message.includes('unique') || teamError.message.includes('duplicate')) {
            throw new Error('A team with this name already exists. Please choose a different name.')
          }
          throw new Error(teamError.message)
        }
        finalTeamId = team.id
        finalTeamName = team.team_name
        setSuccessCode(teamCode)
      } else {
        // JOIN MODE
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('*, participants(id)')
          .eq('team_code', joinCode.trim().toUpperCase())
          .single()

        if (teamError || !team) throw new Error('Invalid Team Code. Please check and try again.')
        
        if (team.participants.length >= 4) {
          throw new Error('This team is already full (max 4 members).')
        }
        
        finalTeamId = team.id
        finalTeamName = team.team_name
      }

      // 2. Sign up each member via Supabase Auth
      for (let i = 0; i < activeMembers.length; i++) {
        const member = activeMembers[i]
        const qrToken = generateQrToken()

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: member.email.trim().toLowerCase(),
          password: member.password,
          options: {
            data: {
              full_name: member.full_name.trim(),
              team_id: finalTeamId,
              qr_token: qrToken,
            },
          },
        })

        if (authError) {
          if (!authError.message.includes('already registered')) {
            throw new Error(`Error registering ${member.full_name}: ${authError.message}`)
          }
        }

        const userId = authData?.user?.id
        if (userId) {
          const { error: partError } = await supabase
            .from('participants')
            .insert({
              id: userId,
              team_id: finalTeamId,
              full_name: member.full_name.trim(),
              email: member.email.trim().toLowerCase(),
              grade: member.grade,
              is_team_leader: mode === 'create' && i === 0,
              qr_token: qrToken,
              checked_in: false,
            })

          if (partError && !partError.message.includes('duplicate')) {
            throw new Error(`Error saving ${member.full_name}: ${partError.message}`)
          }
        }
      }

      setSuccessTeam(finalTeamName)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <Navbar />
        <div className={styles.pageWrapper}>
          <div className={`card ${styles.successCard}`}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>Registration Successful!</h2>
            <p>You have successfully {mode === 'create' ? 'created' : 'joined'} <strong style={{ color: 'var(--color-accent)' }}>{successTeam}</strong>!</p>
            <p>You can now <strong>log in</strong> with your email and the password you just set.</p>

            {mode === 'create' && successCode && (
              <div style={{ background: 'rgba(0,212,180,0.08)', border: '1px solid rgba(0,212,180,0.3)', borderRadius: 'var(--radius)', padding: 'var(--space-3)', width: '100%' }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>📢 Share this code with your teammates so they can join:</p>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '8px', color: 'var(--color-accent)', textAlign: 'center' }}>{successCode}</div>
              </div>
            )}
            <div className={styles.successInfo}>
              <div className={styles.successInfoItem}>
                <span>📅</span>
                <span>July 31 – August 1, 2026</span>
              </div>
              <div className={styles.successInfoItem}>
                <span>🔑</span>
                <span>Login with your email + the password you set</span>
              </div>
              <div className={styles.successInfoItem}>
                <span>🎫</span>
                <span>Your QR code will be in your dashboard</span>
              </div>
            </div>
            <Link href="/login" className="btn btn-primary btn-full">Sign In Now →</Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className={styles.pageWrapper}>
        <div className={styles.formContainer}>
          {/* Header */}
          <div className={styles.formHeader}>
            <Link href="/" className={styles.backLink}>← Back to Home</Link>
            <p className="section-label">GIIS Hackathon 2K26</p>
            <h1 className={styles.formTitle}>
              Participant<br /><span className="gradient-text">Registration</span>
            </h1>
            <p className={styles.formSubtitle}>
              Register a new team or join an existing one using a Team Code.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className={styles.modeToggle}>
            <button 
              type="button"
              className={`${styles.modeBtn} ${mode === 'create' ? styles.modeBtnActive : ''}`}
              onClick={() => { setMode('create'); setMemberCount(1); }}
            >
              🆕 Create a Team
            </button>
            <button 
              type="button"
              className={`${styles.modeBtn} ${mode === 'join' ? styles.modeBtnActive : ''}`}
              onClick={() => { setMode('join'); setMemberCount(1); }}
            >
              🔗 Join a Team
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Team Info */}
            <div className={`card ${styles.formSection}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>01</span>
                {mode === 'create' ? 'Team Identity' : 'Team Verification'}
              </h3>

              {mode === 'create' ? (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="team-name">Team Name *</label>
                    <input
                      id="team-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Cyber Sharks, Code Storm..."
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      maxLength={50}
                      required
                    />
                    <span className="form-hint">{teamName.length}/50 characters</span>
                  </div>
                  <div className={styles.infoBox} style={{ marginBottom: 0 }}>
                    <p>🔑 You are registering as the <strong>Team Leader</strong>. After creating your team, share the <strong>Team Code</strong> with your teammates so they can join and set their own passwords.</p>
                  </div>
                </>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="join-code">Enter Team Code *</label>
                  <input
                    id="join-code"
                    type="text"
                    className="form-control"
                    style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, textAlign: 'center', fontSize: '1.5rem' }}
                    placeholder="XJ29B1"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                  <span className="form-hint">Ask your team leader for the 6-character code</span>
                </div>
              )}
            </div>

            {/* Team Members */}
            <div className={`card ${styles.formSection}`}>
              <h3 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>02</span>
                Team Members
              </h3>

              {members.slice(0, memberCount).map((member, i) => (
                <div key={i} className={styles.memberCard}>
                  <div className={styles.memberHeader}>
                    <div className={styles.memberNum}>{mode === 'create' ? 'Team Leader' : `Member ${i + 1}`}</div>
                    {mode === 'create' && <span className="badge badge-teal">That's you</span>}
                  </div>

                  <div className={styles.memberFields}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor={`name-${i}`}>Full Name *</label>
                      <input
                        id={`name-${i}`}
                        type="text"
                        className="form-control"
                        placeholder="Full name as per school records"
                        value={member.full_name}
                        onChange={e => updateMember(i, 'full_name', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor={`email-${i}`}>Email Address *</label>
                      <input
                        id={`email-${i}`}
                        type="email"
                        className="form-control"
                        placeholder="email@example.com"
                        value={member.email}
                        onChange={e => updateMember(i, 'email', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor={`grade-${i}`}>Grade *</label>
                      <select
                        id={`grade-${i}`}
                        className="form-control"
                        value={member.grade}
                        onChange={e => updateMember(i, 'grade', e.target.value)}
                        required
                      >
                        <option value="" disabled>Select grade</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className={`form-group ${styles.passwordField}`} style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor={`password-${i}`}>Personal Password *</label>
                      <input
                        id={`password-${i}`}
                        type="password"
                        className="form-control"
                        placeholder="Create your own password (min. 8 characters)"
                        value={member.password}
                        onChange={e => updateMember(i, 'password', e.target.value)}
                        minLength={8}
                        required
                      />
                      <span className="form-hint">Only you will know this — use it to log in.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Passwords are now inside each member card below */}

            {/* Error */}
            {error && (
              <div className="alert alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={`btn btn-primary btn-lg btn-full ${loading ? 'btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Registering...' : '🚀 Register Team'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
              Already registered?{' '}
              <Link href="/login" style={{ color: 'var(--color-accent)' }}>Sign in here →</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
