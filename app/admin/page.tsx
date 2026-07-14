'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'

interface Stats {
  totalTeams: number
  totalParticipants: number
  checkedIn: number
  submissions: number
}

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({ totalTeams: 0, totalParticipants: 0, checkedIn: 0, submissions: 0 })
  const [recentTeams, setRecentTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [settings, setSettings] = useState<any>({ submissions_enabled: true, team_switching_enabled: true })
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)

      fetch('/api/admin/settings').then((res) => res.json()).then((data) => setSettings(data))

      const [teams, participants, checkedIn, submissions] = await Promise.all([
        supabase.from('teams').select('id', { count: 'exact', head: true }),
        supabase.from('participants').select('id', { count: 'exact', head: true }),
        supabase.from('participants').select('id', { count: 'exact', head: true }).eq('checked_in', true),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
      ])

      setStats({
        totalTeams: teams.count || 0,
        totalParticipants: participants.count || 0,
        checkedIn: checkedIn.count || 0,
        submissions: submissions.count || 0,
      })

      const { data: rt } = await supabase
        .from('teams').select('*, participants(count)').order('created_at', { ascending: false }).limit(5)
      setRecentTeams(rt || [])
      setLoading(false)
    }
    load()
  }, [router])

  const toggleSetting = async (key: string, currentValue: boolean) => {
    if (isUpdating) return
    setIsUpdating(key)
    const newValue = !currentValue
    setSettings((prev: any) => ({ ...prev, [key]: newValue }))
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue }),
      })
      if (!res.ok) throw new Error()
      const data = await fetch('/api/admin/settings').then((r) => r.json())
      setSettings(data)
    } catch {
      setSettings((prev: any) => ({ ...prev, [key]: currentValue }))
    } finally {
      setIsUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="overview" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading…
          </div>
        </main>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Teams', value: stats.totalTeams, sub: 'registered' },
    { label: 'Participants', value: stats.totalParticipants, sub: 'registered' },
    { label: 'Checked In', value: stats.checkedIn, sub: `${stats.totalParticipants > 0 ? Math.round((stats.checkedIn / stats.totalParticipants) * 100) : 0}% of registered` },
    { label: 'Submissions', value: stats.submissions, sub: `of ${stats.totalTeams} teams` },
  ]

  const Toggle = ({ label, k }: { label: string; k: string }) => {
    const on = !!settings[k]
    return (
      <button
        onClick={() => toggleSetting(k, on)}
        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
          on ? 'border-brand/40 bg-brand/[0.06]' : 'border-bad/40 bg-bad/[0.06]'
        }`}
      >
        <span className="flex items-center gap-3">
          <span className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${on ? 'bg-brand justify-end' : 'bg-line justify-start'}`}>
            <span className="h-4 w-4 rounded-full bg-base" />
          </span>
          <span className={`font-mono text-[0.72rem] uppercase tracking-[0.1em] ${on ? 'text-brand' : 'text-bad'}`}>{label}: {on ? 'On' : 'Off'}</span>
        </span>
        {isUpdating === k && <span className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-dim">syncing…</span>}
      </button>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="overview" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Overview</h1>
            <p className="text-sm text-ink-sub">GIIS Hackathon 2K26 · Admin Dashboard</p>
          </div>
          <Link href="/admin/checkin" className="rounded-lg bg-gradient-to-br from-brand to-brand-blue px-4 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90">
            Open Check-in Scanner →
          </Link>
        </div>

        {/* Command center */}
        <div className={`${card} mb-6`}>
          <div className="mb-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-brand">Command Center</h2>
            <p className="text-xs text-ink-dim">Master event controls</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Submissions" k="submissions_enabled" />
            <Toggle label="Team Switching" k="team_switching_enabled" />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className={card}>
              <div className="font-display text-3xl font-black text-brand">{s.value}</div>
              <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-sub">{s.label}</div>
              <div className="mt-0.5 text-xs text-ink-dim">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className={`${card} mb-6`}>
          <h2 className="mb-4 font-display text-base font-bold text-ink">Event Progress</h2>
          {[
            { label: 'Check-in Rate', num: stats.checkedIn, den: stats.totalParticipants, unit: '', color: 'bg-good' },
            { label: 'Submission Rate', num: stats.submissions, den: stats.totalTeams, unit: ' teams', color: 'bg-warn' },
          ].map((p) => (
            <div key={p.label} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-ink-sub">{p.label}</span>
                <span className="font-mono text-ink">{p.num}/{p.den}{p.unit}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-line bg-base">
                <div className={`h-full ${p.color}`} style={{ width: `${p.den > 0 ? (p.num / p.den) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent teams */}
        <div className={`${card} mb-6`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink">Recently Registered Teams</h2>
            <Link href="/admin/teams" className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-brand hover:underline">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Team Name', 'Team Code', 'Members', 'Registered'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTeams.map((t) => (
                  <tr key={t.id} className="border-b border-line-soft last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{t.team_name}</td>
                    <td className="px-3 py-3 font-mono tracking-[0.2em] text-brand">{t.team_code}</td>
                    <td className="px-3 py-3 text-ink-sub">{t.participants?.[0]?.count ?? '–'}</td>
                    <td className="px-3 py-3 text-ink-sub">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {recentTeams.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-ink-dim">No teams registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/teams', label: 'Manage Teams', desc: 'View all teams and participants' },
            { href: '/admin/checkin', label: 'QR Check-in', desc: 'Scan participant QR codes' },
            { href: '/admin/submissions', label: 'Submissions', desc: 'Browse project submissions' },
            { href: '/admin/judging', label: 'Judging', desc: 'Score teams & leaderboard' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className={`${card} group transition-colors hover:border-brand/40`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-ink">{l.label}</h3>
                <span className="font-mono text-ink-dim transition-colors group-hover:text-brand">→</span>
              </div>
              <p className="mt-1 text-xs text-ink-dim">{l.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
