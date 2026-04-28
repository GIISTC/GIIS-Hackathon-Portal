'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import styles from './page.module.css'

interface Stats {
  totalTeams: number
  totalParticipants: number
  checkedIn: number
  submissions: number
}

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

      // Check admin role
      const { data: judge } = await supabase
        .from('judges')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)

      // Fetch settings
      fetch('/api/admin/settings').then(res => res.json()).then(data => setSettings(data))

      // Fetch stats
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

      // Recent teams
      const { data: rt } = await supabase
        .from('teams')
        .select('*, participants(count)')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentTeams(rt || [])

      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className={styles.adminWrapper}>
        <AdminNav active="overview" adminName={adminName} />
        <main className={styles.adminMain}>
          <div className="loading-overlay"><div className="spinner" /><span>Loading...</span></div>
        </main>
      </div>
    )
  }


  const toggleSetting = async (key: string, currentValue: boolean) => {
    if (isUpdating) return
    setIsUpdating(key)
    
    const newValue = !currentValue
    
    // 1. Update UI instantly
    setSettings((prev: any) => ({ ...prev, [key]: newValue }))

    try {
      // 2. Sync with DB
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue })
      })
      
      if (!res.ok) throw new Error()
      
      // 3. Final sync to be sure
      const data = await fetch('/api/admin/settings').then(r => r.json())
      setSettings(data)
    } catch (e) {
      console.error('Failed to sync settings:', e)
      setSettings((prev: any) => ({ ...prev, [key]: currentValue }))
    } finally {
      setIsUpdating(null)
    }
  }

  const statCards = [
    { label: 'Total Teams', value: stats.totalTeams, icon: '🏆', color: 'var(--color-accent)', sub: `of expected ~100` },
    { label: 'Participants', value: stats.totalParticipants, icon: '👥', color: 'var(--color-accent-3)', sub: `~400 expected` },
    { label: 'Checked In', value: stats.checkedIn, icon: '✅', color: 'var(--color-success)', sub: `${stats.totalParticipants > 0 ? Math.round(stats.checkedIn / stats.totalParticipants * 100) : 0}% of registered` },
    { label: 'Submissions', value: stats.submissions, icon: '📦', color: 'var(--color-warning)', sub: `of ${stats.totalTeams} teams` },
  ]

  return (
    <div className={styles.adminWrapper}>
      <AdminNav active="overview" adminName={adminName} />
      <main className={styles.adminMain}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Overview</h1>
            <p className={styles.pageSub}>GIIS Hackathon 2K26 · Admin Dashboard</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/checkin" className="btn btn-primary btn-sm">🎫 Open Check-in Scanner</Link>
          </div>
        </div>

        {/* COMMAND CENTER */}
        <div className={styles.commandCenter}>
          <div className={styles.commandHeader}>
            <h3 className={styles.commandTitle}>Command Center</h3>
            <p className={styles.commandSub}>Master event controls</p>
          </div>
          <div className={styles.toggleGrid}>
            
            {/* SUBMISSIONS TOGGLE */}
            <div className={styles.simpleToggle}>
              <input 
                id="check-submissions"
                type="checkbox" 
                className={styles.largeCheckbox}
                checked={!!settings.submissions_enabled} 
                onChange={() => toggleSetting('submissions_enabled', !!settings.submissions_enabled)}
              />
              <label htmlFor="check-submissions" className={styles.toggleLabel} style={{ color: settings.submissions_enabled ? '#00ffd5' : '#ff5252' }}>
                {settings.submissions_enabled ? 'Submissions are OPEN' : 'Submissions are LOCKED'}
              </label>
              {isUpdating === 'submissions_enabled' && <span className={styles.syncing}>SYNCING...</span>}
            </div>

            {/* TEAM SWITCHING TOGGLE */}
            <div className={styles.simpleToggle}>
              <input 
                id="check-teams"
                type="checkbox" 
                className={styles.largeCheckbox}
                checked={!!settings.team_switching_enabled} 
                onChange={() => toggleSetting('team_switching_enabled', !!settings.team_switching_enabled)}
              />
              <label htmlFor="check-teams" className={styles.toggleLabel} style={{ color: settings.team_switching_enabled ? '#00ffd5' : '#ff5252' }}>
                {settings.team_switching_enabled ? 'Team Switching is ALLOWED' : 'Team Switching is LOCKED'}
              </label>
              {isUpdating === 'team_switching_enabled' && <span className={styles.syncing}>SYNCING...</span>}
            </div>

          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          {statCards.map(s => (
            <div key={s.label} className={`card ${styles.statCard}`}>
              <div className={styles.statIcon} style={{ color: s.color }}>{s.icon}</div>
              <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Progress Bars */}
        <div className={`card ${styles.progressCard}`}>
          <h3 className={styles.cardTitle}>Event Progress</h3>
          <div className={styles.progressItems}>
            <div className={styles.progressItem}>
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <span className={styles.progressLabel}>Check-in Rate</span>
                <span className={styles.progressValue}>
                  {stats.checkedIn}/{stats.totalParticipants}
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${stats.totalParticipants > 0 ? (stats.checkedIn / stats.totalParticipants) * 100 : 0}%`, background: 'var(--color-success)' }}
                />
              </div>
            </div>
            <div className={styles.progressItem}>
              <div className="flex-between" style={{ marginBottom: 6 }}>
                <span className={styles.progressLabel}>Submission Rate</span>
                <span className={styles.progressValue}>
                  {stats.submissions}/{stats.totalTeams} teams
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${stats.totalTeams > 0 ? (stats.submissions / stats.totalTeams) * 100 : 0}%`, background: 'var(--color-warning)' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Teams */}
        <div className={`card ${styles.tableCard}`}>
          <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
            <h3 className={styles.cardTitle}>Recently Registered Teams</h3>
            <Link href="/admin/teams" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Team Code</th>
                  <th>Members</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {recentTeams.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{t.team_name}</td>
                    <td><code style={{ color: 'var(--color-accent)', letterSpacing: '2px' }}>{t.team_code}</code></td>
                    <td>{t.participants?.[0]?.count ?? '–'}</td>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {recentTeams.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>No teams registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className={styles.quickLinks}>
          {[
            { href: '/admin/teams', label: 'Manage Teams', icon: '👥', desc: 'View all registered teams and participants' },
            { href: '/admin/checkin', label: 'QR Check-in', icon: '📷', desc: 'Scan participant QR codes for check-in' },
            { href: '/admin/submissions', label: 'Submissions', icon: '📦', desc: 'Browse and review all project submissions' },
            { href: '/admin/judging', label: 'Judging', icon: '⚖️', desc: 'Score teams and view the leaderboard' },
          ].map(l => (
            <Link key={l.href} href={l.href} className={`card card-hover ${styles.quickLink}`}>
              <div className={styles.quickLinkIcon}>{l.icon}</div>
              <h4 className={styles.quickLinkLabel}>{l.label}</h4>
              <p className={styles.quickLinkDesc}>{l.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
