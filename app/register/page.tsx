'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']

const TRACKS = [
  { value: 'App Dev', label: 'App Dev — MIT App Inventor / Kodular' },
  { value: 'Web Dev', label: 'Web Dev — Any framework or vanilla HTML/CSS/JS' },
  { value: 'Game Dev', label: 'Game Dev — Scratch only' },
]

interface Member {
  full_name: string
  email: string
  grade: string
  password: string
}

const emptyMember = (): Member => ({ full_name: '', email: '', grade: '', password: '' })
const generateTeamCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()
const generateQrToken = () => crypto.randomUUID()

const inputCls =
  'w-full rounded-lg border border-line bg-panel/60 px-4 py-3 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand focus:bg-panel'
const labelCls = 'mb-1.5 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand'
const sectionCls = 'rounded-card border border-line bg-panel/70 p-6'
const sectionNum = 'flex h-7 w-7 items-center justify-center rounded-full border border-brand/40 bg-brand/10 font-mono text-xs font-bold text-brand'

export default function RegisterPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [teamName, setTeamName] = useState('')
  const [track, setTrack] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinPreview, setJoinPreview] = useState<{ team_name: string; track: string | null } | null>(null)
  const [joinPreviewError, setJoinPreviewError] = useState<string | null>(null)
  const [memberCount, setMemberCount] = useState(1)
  const [members, setMembers] = useState<Member[]>([emptyMember()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successTeam, setSuccessTeam] = useState('')
  const [successCode, setSuccessCode] = useState('')

  const updateMember = (index: number, field: keyof Member, value: string) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }

  const lookupJoinTeam = async () => {
    setJoinPreview(null)
    setJoinPreviewError(null)
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return
    const supabase = createClient()
    const { data: team, error } = await supabase.from('teams').select('team_name, track').eq('team_code', code).single()
    if (error || !team) { setJoinPreviewError('No team found with this code.'); return }
    setJoinPreview(team)
  }

  const validate = (): string | null => {
    if (mode === 'create' && !teamName.trim()) return 'Team name is required.'
    if (mode === 'create' && teamName.trim().length < 3) return 'Team name must be at least 3 characters.'
    if (mode === 'create' && !track) return 'Please select a track.'
    for (let i = 0; i < memberCount; i++) {
      const m = members[i]
      if (!m.full_name.trim()) return `Member ${i + 1}: Full name is required.`
      if (!m.email.trim() || !m.email.includes('@')) return `Member ${i + 1}: Valid email is required.`
      if (!m.grade) return `Member ${i + 1}: Grade is required.`
      if (!m.password || m.password.length < 8) return `Member ${i + 1}: Password must be at least 8 characters.`
    }
    const emails = members.slice(0, memberCount).map((m) => m.email.toLowerCase())
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
      const emails = activeMembers.map((m) => m.email.trim().toLowerCase())
      const { data: existingEmails, error: checkError } = await supabase.rpc('check_existing_emails', { emails_to_check: emails })
      if (checkError) throw new Error('Could not verify emails. Please try again.')
      if (existingEmails && existingEmails.length > 0) {
        throw new Error(`Email ${existingEmails.join(', ')} is already registered! Sign in instead!`)
      }

      if (mode === 'create') {
        const teamCode = generateTeamCode()
        const { data: team, error: teamError } = await supabase
          .from('teams').insert({ team_name: teamName.trim(), team_code: teamCode, track }).select().single()
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
        const { data: team, error: teamError } = await supabase
          .from('teams').select('*, participants(id)').eq('team_code', joinCode.trim().toUpperCase()).single()
        if (teamError || !team) throw new Error('Invalid Team Code. Please check and try again.')
        if (team.participants.length >= 4) throw new Error('This team is already full (max 4 members).')
        finalTeamId = team.id
        finalTeamName = team.team_name
      }

      for (let i = 0; i < activeMembers.length; i++) {
        const member = activeMembers[i]
        const qrToken = generateQrToken()
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: member.email.trim().toLowerCase(),
          password: member.password,
          options: { data: { full_name: member.full_name.trim(), team_id: finalTeamId, qr_token: qrToken } },
        })
        if (authError && !authError.message.includes('already registered')) {
          throw new Error(`Error registering ${member.full_name}: ${authError.message}`)
        }
        const userId = authData?.user?.id
        if (userId) {
          const { error: partError } = await supabase.from('participants').insert({
            id: userId, team_id: finalTeamId, full_name: member.full_name.trim(),
            email: member.email.trim().toLowerCase(), grade: member.grade,
            is_team_leader: mode === 'create' && i === 0, qr_token: qrToken, checked_in: false,
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

  const glow = (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
      style={{ background: 'radial-gradient(70% 45% at 50% 0%, rgba(47,230,200,0.07), transparent 60%)' }} />
  )

  if (success) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        {glow}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-28">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-panel/70 p-8 text-center shadow-panel backdrop-blur">
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-brand">Registration Complete</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink">You&apos;re In</h1>
            <p className="mt-2 text-ink-sub">
              You&apos;ve {mode === 'create' ? 'created' : 'joined'}{' '}
              <strong className="text-brand">{successTeam}</strong>.
            </p>
            {mode === 'create' && successCode && (
              <div className="mt-5 rounded-card border border-brand/30 bg-brand/[0.06] p-4">
                <p className="text-sm text-ink-sub">Share this code with your teammates so they can join:</p>
                <div className="mt-2 font-display text-4xl font-black tracking-[0.3em] text-brand">{successCode}</div>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 text-left text-sm text-ink-sub">
              <div className="flex items-center gap-2"><span className="text-brand">›</span> July 31 – August 1, 2026</div>
              <div className="flex items-center gap-2"><span className="text-brand">›</span> Log in with your email + the password you set</div>
              <div className="flex items-center gap-2"><span className="text-brand">›</span> Your QR code lives in your dashboard</div>
            </div>
            <Link href="/login" className="mt-6 inline-block w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90">
              Sign In Now →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const modeBtn = (active: boolean) =>
    `flex-1 rounded-lg border py-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] transition-colors ${
      active ? 'border-brand bg-brand/10 text-brand' : 'border-line text-ink-sub hover:text-ink'
    }`

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      {glow}
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-28">
        <div className="mb-6">
          <Link href="/" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-dim hover:text-brand">← Back to Home</Link>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// GIIS Hackathon 2K26</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Participant Registration</h1>
          <p className="mt-2 text-ink-sub">Register a new team or join an existing one with a Team Code.</p>
        </div>

        <div className="mb-6 flex gap-3">
          <button type="button" className={modeBtn(mode === 'create')} onClick={() => { setMode('create'); setMemberCount(1) }}>Create a Team</button>
          <button type="button" className={modeBtn(mode === 'join')} onClick={() => { setMode('join'); setMemberCount(1) }}>Join a Team</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Team info */}
          <div className={sectionCls}>
            <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold text-ink">
              <span className={sectionNum}>01</span>{mode === 'create' ? 'Team Identity' : 'Team Verification'}
            </h2>
            {mode === 'create' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls} htmlFor="team-name">Team Name *</label>
                  <input id="team-name" type="text" className={inputCls} placeholder="e.g. Cyber Sharks, Code Storm…"
                    value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={50} required />
                  <span className="mt-1 block text-xs text-ink-dim">{teamName.length}/50 characters</span>
                </div>
                <div>
                  <label className={labelCls} htmlFor="track">Track *</label>
                  <select id="track" className={inputCls} value={track} onChange={(e) => setTrack(e.target.value)} required>
                    <option value="" disabled>Select your track</option>
                    {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-ink-dim">App Dev &amp; Web Dev share one leaderboard; Game Dev has its own.</span>
                </div>
                <div className="rounded-lg border border-brand/25 bg-brand/[0.06] px-4 py-3 text-sm text-ink-sub">
                  You&apos;re registering as the <strong className="text-ink">Team Leader</strong>. After creating your team, share the Team Code so teammates can join and set their own passwords.
                </div>
              </div>
            ) : (
              <div>
                <label className={labelCls} htmlFor="join-code">Enter Team Code *</label>
                <input id="join-code" type="text" maxLength={6} required
                  className={`${inputCls} text-center text-2xl font-bold uppercase tracking-[0.3em]`}
                  placeholder="XJ29B1" value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setJoinPreview(null); setJoinPreviewError(null) }}
                  onBlur={lookupJoinTeam} />
                <span className="mt-1 block text-xs text-ink-dim">Ask your team leader for the 6-character code.</span>
                {joinPreview && (
                  <div className="mt-3 rounded-lg border border-brand/25 bg-brand/[0.06] px-4 py-3 text-sm text-ink-sub">
                    Joining <strong className="text-ink">{joinPreview.team_name}</strong> · Track:{' '}
                    <strong className="text-brand">{joinPreview.track || 'Not set yet'}</strong>
                  </div>
                )}
                {joinPreviewError && (
                  <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-[#fca5a5]">{joinPreviewError}</div>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className={sectionCls}>
            <h2 className="mb-4 flex items-center gap-3 font-display text-base font-bold text-ink">
              <span className={sectionNum}>02</span>Team Members
            </h2>
            {members.slice(0, memberCount).map((member, i) => (
              <div key={i} className="mb-4 rounded-lg border border-line bg-base/40 p-4 last:mb-0">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-sub">
                    {mode === 'create' ? 'Team Leader' : `Member ${i + 1}`}
                  </span>
                  {mode === 'create' && <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.58rem] uppercase text-brand">That&apos;s you</span>}
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className={labelCls} htmlFor={`name-${i}`}>Full Name *</label>
                    <input id={`name-${i}`} type="text" className={inputCls} placeholder="Full name as per school records"
                      value={member.full_name} onChange={(e) => updateMember(i, 'full_name', e.target.value)} required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor={`email-${i}`}>Email Address *</label>
                      <input id={`email-${i}`} type="email" className={inputCls} placeholder="email@example.com"
                        value={member.email} onChange={(e) => updateMember(i, 'email', e.target.value)} required />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`grade-${i}`}>Grade *</label>
                      <select id={`grade-${i}`} className={inputCls} value={member.grade}
                        onChange={(e) => updateMember(i, 'grade', e.target.value)} required>
                        <option value="" disabled>Select grade</option>
                        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`password-${i}`}>Personal Password *</label>
                    <input id={`password-${i}`} type="password" className={inputCls} minLength={8} required
                      placeholder="Create your own password (min. 8 characters)"
                      value={member.password} onChange={(e) => updateMember(i, 'password', e.target.value)} />
                    <span className="mt-1 block text-xs text-ink-dim">Only you will know this — use it to log in.</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-[#fca5a5]">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? 'Registering…' : 'Register Team'}
          </button>

          <p className="text-center text-sm text-ink-sub">
            Already registered? <Link href="/login" className="text-brand hover:underline">Sign in here →</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
