'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Participant, Team, Submission, LeaderboardEntry } from '@/lib/types'

const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'
const primaryBtn = 'rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50'
const outlineBtn = 'rounded-lg border border-line py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5'

export default function DashboardPage() {
  const router = useRouter()
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teammates, setTeammates] = useState<Participant[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [switchCode, setSwitchCode] = useState('')
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [showSwitch, setShowSwitch] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [teamSwitchingEnabled, setTeamSwitchingEnabled] = useState(true)
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      const { data: settingRow } = await supabase
        .from('system_settings').select('value').eq('key', 'team_switching_enabled').maybeSingle()
      setTeamSwitchingEnabled(settingRow ? settingRow.value === true : false)

      const { data: part, error: partError } = await supabase
        .from('participants').select('*, team:teams(*)').eq('id', user.id).single()

      if (partError || !part) { setNeedsProfile(true); setLoading(false); return }

      setParticipant(part)
      setTeam(part.team as unknown as Team)

      fetch('/api/leaderboard').then((r) => r.json()).then((data) => {
        if (!data?.pools) return
        const pool = (part.team as any)?.track === 'Game Dev' ? 'game_dev' : 'app_web'
        for (const category of ['Junior', 'Senior'] as const) {
          const entry = (data.pools[pool]?.[category] || []).find((e: LeaderboardEntry) => e.team_id === part.team_id)
          if (entry) { setMyRank(entry); return }
        }
      }).catch(() => {})

      const { data: mates } = await supabase.from('participants').select('*').eq('team_id', part.team_id).neq('id', user.id)
      setTeammates(mates || [])

      const { data: sub } = await supabase.from('submissions').select('*').eq('team_id', part.team_id).single()
      setSubmission(sub)
      setLoading(false)

      if (part.qr_token) {
        try {
          const QRCode = (await import('qrcode')).default
          const payload = JSON.stringify({ token: part.qr_token, name: part.full_name })
          const url = await QRCode.toDataURL(payload, { width: 280, margin: 2, color: { dark: '#2fe6c8', light: '#070c16' } })
          setQrDataUrl(url)
        } catch (err) { console.error('QR generation error:', err) }
      }
    }
    load()
  }, [router])

  const downloadQR = () => {
    if (!qrDataUrl || !participant) return
    const link = document.createElement('a')
    link.download = `GIIS-Hack-2K26-QR-${participant.full_name.replace(/\s+/g, '-')}.png`
    link.href = qrDataUrl
    link.click()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSwitchTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!switchCode.trim() || switchCode.trim().toUpperCase() === team?.team_code) return
    setSwitchLoading(true)
    setSwitchError(null)
    const supabase = createClient()
    try {
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams').select('*, participants(id)').eq('team_code', switchCode.trim().toUpperCase()).single()
      if (teamErr || !newTeam) throw new Error('Invalid Team Code.')
      if (newTeam.participants.length >= 4) throw new Error('Target team is already full.')

      const oldTeamId = team?.id
      const myId = participant?.id
      const { error: updateErr } = await supabase
        .from('participants').update({ team_id: newTeam.id, is_team_leader: false }).eq('id', myId)
      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`)

      if (oldTeamId) {
        const { data: remainingMembers } = await supabase.from('participants').select('id').eq('team_id', oldTeamId)
        if (!remainingMembers || remainingMembers.length === 0) {
          await supabase.from('submissions').delete().eq('team_id', oldTeamId)
          await supabase.from('teams').delete().eq('id', oldTeamId)
        } else {
          const hasLeader = await supabase.from('participants').select('id').eq('team_id', oldTeamId).eq('is_team_leader', true).single()
          if (!hasLeader.data) {
            await supabase.from('participants').update({ is_team_leader: true }).eq('id', remainingMembers[0].id)
          }
        }
      }
      window.location.reload()
    } catch (err: any) {
      setSwitchError(err.message)
      setSwitchLoading(false)
    }
  }

  const handleRepairProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const fullName = formData.get('fullname') as string
    const grade = formData.get('grade') as string
    const code = switchCode.trim().toUpperCase()
    setSwitchLoading(true)
    setSwitchError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    try {
      if (!user) throw new Error('Not authenticated.')
      if (!code) throw new Error('Team code is required.')
      const { data: targetTeam, error: teamErr } = await supabase
        .from('teams').select('*, participants(id)').eq('team_code', code).single()
      if (teamErr || !targetTeam) throw new Error('Invalid Team Code.')
      if (targetTeam.participants.length >= 4) throw new Error('Team is full.')
      const { error: partError } = await supabase.from('participants').insert({
        id: user.id, team_id: targetTeam.id, full_name: fullName, email: user.email,
        grade, qr_token: crypto.randomUUID(), is_team_leader: false,
      })
      if (partError) throw new Error(partError.message)
      window.location.reload()
    } catch (err: any) {
      setSwitchError(err.message)
      setSwitchLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading your dashboard…
        </div>
      </div>
    )
  }

  if (needsProfile) {
    return (
      <div className="min-h-screen bg-base font-body text-ink">
        <Navbar />
        <div className="flex min-h-screen items-center justify-center px-4 py-28">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel/70 p-8 shadow-panel">
            <h1 className="font-display text-2xl font-bold text-brand">Finish Your Profile</h1>
            <p className="mt-1.5 text-sm text-ink-sub">Your account exists but we couldn&apos;t find your team details. Let&apos;s fix that.</p>
            <form onSubmit={handleRepairProfile} className="mt-6 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="text" className={`${inputCls} opacity-60`} value={userEmail} disabled />
              </div>
              <div>
                <label className={labelCls} htmlFor="fullname">Full Name *</label>
                <input id="fullname" name="fullname" type="text" className={inputCls} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="grade">Grade *</label>
                <select id="grade" name="grade" className={inputCls} required defaultValue="">
                  <option value="" disabled>Select grade</option>
                  {['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="code">Team Code to Join *</label>
                <input id="code" type="text" className={inputCls} placeholder="XJ29B1" value={switchCode} onChange={(e) => setSwitchCode(e.target.value)} required />
              </div>
              {switchError && <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-[#fca5a5]">{switchError}</div>}
              <button type="submit" className={primaryBtn} disabled={switchLoading}>{switchLoading ? 'Repairing…' : 'Complete Registration →'}</button>
              <button type="button" className="py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-dim hover:text-ink" onClick={handleSignOut}>Sign Out</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const statTile = (label: string, value: string, accent?: string) => (
    <div className={`${card} text-center`}>
      <div className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ink-dim">{label}</div>
      <div className={`mt-1 font-display text-base font-bold ${accent || 'text-ink'}`}>{value}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 pt-24 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {/* QR card */}
          <div className={`${card} flex flex-col items-center gap-3 text-center`}>
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand">Your Pass</span>
              {participant?.checked_in && <span className="rounded-full bg-good/15 px-2.5 py-1 font-mono text-[0.55rem] font-bold uppercase text-good">✓ Checked In</span>}
            </div>
            <div className="relative overflow-hidden rounded-lg border-2 border-brand/30 bg-base">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Your QR Code" width={240} height={240} className="block h-60 w-60" />
              ) : (
                <div className="flex h-60 w-60 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
                </div>
              )}
            </div>
            <div className="w-full">
              <p className="font-display text-base font-bold text-ink">{participant?.full_name}</p>
              <p className="text-sm text-brand">{team?.team_name}</p>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-dim">{participant?.grade}</p>
            </div>
            <button onClick={downloadQR} disabled={!qrDataUrl} className={`${outlineBtn} w-full`}>Download QR Code</button>
            <p className="text-xs text-ink-dim">Use this QR code for check-in, food collection, and event access.</p>
          </div>

          {/* Nav */}
          <div className={`${card} flex flex-col gap-1 p-3`}>
            {[
              { href: '/dashboard', label: 'Dashboard', active: true },
              { href: '/dashboard/submit', label: 'Submit Project' },
              { href: '/dashboard/side-quests', label: 'Side Quests' },
              { href: '/leaderboard', label: 'Leaderboard' },
            ].map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-lg px-4 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors ${
                  l.active ? 'border-l-2 border-brand bg-brand/10 text-brand' : 'text-ink-sub hover:bg-panel hover:text-ink'
                }`}>
                {l.label}
              </Link>
            ))}
            <button onClick={handleSignOut} className="rounded-lg px-4 py-2.5 text-left font-mono text-[0.72rem] uppercase tracking-[0.12em] text-bad/80 transition-colors hover:bg-bad/10 hover:text-bad">Sign Out</button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Hey, <span className="text-brand">{participant?.full_name.split(' ')[0]}</span>!
              </h1>
              <p className="text-sm text-ink-sub">Welcome to the GIIS Hackathon 2K26 participant portal</p>
            </div>
            <span className="rounded-full bg-brand/10 px-3 py-1 font-mono text-[0.6rem] font-bold uppercase text-brand">Jul 31 – Aug 1</span>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statTile('Team', team?.team_name || '—')}
            {statTile('Members', `${teammates.length + 1} / 4`)}
            {statTile('Check-in', participant?.checked_in ? 'Done' : 'Pending', participant?.checked_in ? 'text-good' : 'text-warn')}
            {statTile('Submission', submission ? 'Submitted' : 'Not yet', submission ? 'text-good' : 'text-warn')}
          </div>

          {/* Rank */}
          {myRank && (
            <div className={card}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink">Your Standing</h2>
                <Link href="/leaderboard" className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-brand hover:underline">View Leaderboard →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statTile('Rank', `#${myRank.rank}`, 'text-brand')}
                {statTile('Total Score', myRank.total_score.toFixed(1), 'text-brand')}
                {statTile('Side Quest Pts', String(myRank.side_quest_points))}
                {statTile('Pool', `${myRank.pool === 'game_dev' ? 'Game Dev' : 'App/Web'} · ${myRank.category}`)}
              </div>
            </div>
          )}

          {/* Team members */}
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Team Members</h2>
              <div className="flex items-center gap-2">
                {teamSwitchingEnabled ? (
                  <button onClick={() => setShowSwitch(!showSwitch)}
                    className={`rounded-full border px-3 py-1 font-mono text-[0.58rem] font-bold uppercase transition-colors ${showSwitch ? 'border-bad/50 text-bad' : 'border-brand/50 text-brand hover:bg-brand/5'}`}>
                    {showSwitch ? '✕ Close' : 'Join Different Team'}
                  </button>
                ) : (
                  <span className="rounded-full border border-line px-3 py-1 font-mono text-[0.58rem] uppercase text-ink-dim">Teams Locked</span>
                )}
                <span className="rounded-full bg-brand/10 px-3 py-1 font-mono text-[0.58rem] font-bold uppercase text-brand">{teammates.length + 1} Members</span>
              </div>
            </div>

            {showSwitch && (
              <form onSubmit={handleSwitchTeam} className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-brand/30 bg-brand/[0.04] p-4">
                <p className="text-sm font-medium text-ink">Join a different team using their code:</p>
                <div className="flex gap-2">
                  <input type="text" maxLength={6} placeholder="ENTER CODE" value={switchCode} onChange={(e) => setSwitchCode(e.target.value)}
                    className={`${inputCls} uppercase tracking-[0.2em]`} />
                  <button type="submit" disabled={switchLoading} className={`${primaryBtn} shrink-0 px-5`}>{switchLoading ? 'Joining…' : 'Join'}</button>
                </div>
                {switchError && <p className="text-sm text-bad">{switchError}</p>}
                <p className="text-xs italic text-ink-dim">Note: you&apos;ll lose access to your current team&apos;s project submission.</p>
              </form>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-base/40 px-3 py-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand font-display font-black text-base">{participant?.full_name[0]}</span>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    {participant?.full_name} <span className="rounded-full bg-brand-blue/15 px-2 py-0.5 font-mono text-[0.5rem] uppercase text-brand-blue">You</span>
                  </span>
                  <span className="truncate text-xs text-ink-dim">{participant?.grade} · {participant?.email}</span>
                </div>
                {participant?.is_team_leader && <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.55rem] font-bold uppercase text-brand">Leader</span>}
              </div>
              {teammates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-base/40 px-3 py-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand font-display font-black text-base">{t.full_name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{t.full_name}</span>
                    <span className="truncate text-xs text-ink-dim">{t.grade} · {t.email}</span>
                  </div>
                  {t.is_team_leader && <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.55rem] font-bold uppercase text-brand">Leader</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Submission */}
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">Project Submission</h2>
              <span className={`rounded-full px-3 py-1 font-mono text-[0.58rem] font-bold uppercase ${submission ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'}`}>
                {submission ? '✓ Submitted' : 'Not Submitted'}
              </span>
            </div>
            {submission ? (
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-lg font-bold text-brand-blue">{submission.project_name}</h3>
                <p className="text-sm text-ink-sub">{submission.description.substring(0, 150)}…</p>
                <div className="flex flex-wrap gap-2">
                  {submission.github_url && <a href={submission.github_url} target="_blank" className="rounded-full border border-line px-4 py-1.5 text-xs text-brand-blue hover:border-brand/50">GitHub ↗</a>}
                  {submission.drive_url && <a href={submission.drive_url} target="_blank" className="rounded-full border border-line px-4 py-1.5 text-xs text-brand-blue hover:border-brand/50">Drive ↗</a>}
                  {submission.demo_url && <a href={submission.demo_url} target="_blank" className="rounded-full border border-line px-4 py-1.5 text-xs text-brand-blue hover:border-brand/50">Demo ↗</a>}
                </div>
                <Link href="/dashboard/submit" className={`${outlineBtn} w-fit px-5`}>Edit Submission</Link>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-ink-sub">Your team hasn&apos;t submitted a project yet. Submissions open during the hackathon.</p>
                <Link href="/dashboard/submit" className={`${primaryBtn} px-6`}>Submit Project →</Link>
              </div>
            )}
          </div>

          {/* Quick info */}
          <div className={card}>
            <h2 className="mb-3 font-display text-base font-bold text-ink">Quick Info</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ink-dim">Team Code</div>
                <div className="mt-1 inline-block rounded bg-brand/10 px-2.5 py-1 font-mono text-lg font-bold tracking-[0.2em] text-brand">{team?.team_code}</div>
              </div>
              {[
                ['Event Dates', 'July 31 – August 1, 2026'],
                ['Check-in Time', '8:00 AM, July 31'],
                ['Submission Deadline', '12:00 PM, August 1'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-ink-dim">{k}</div>
                  <div className="mt-1 text-sm text-ink">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
