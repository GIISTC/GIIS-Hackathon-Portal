'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import styles from '../page.module.css'

export default function AdminTeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)

      const { data: teamsData } = await supabase
        .from('teams')
        .select('*, participants(*)')
        .order('created_at', { ascending: false })
      setTeams(teamsData || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className={styles.adminWrapper}>
        <AdminNav active="teams" adminName={adminName} />
        <main className={styles.adminMain}>
          <div className="loading-overlay"><div className="spinner" /><span>Loading teams...</span></div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.adminWrapper}>
      <AdminNav active="teams" adminName={adminName} />
      <main className={styles.adminMain}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Manage Teams</h1>
            <p className={styles.pageSub}>View all registered teams and participants</p>
          </div>
        </div>

        <div className={`card ${styles.tableCard}`}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Team Code</th>
                  <th>Members</th>
                  <th>Track</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{t.team_name}</td>
                    <td><code style={{ color: 'var(--color-accent)', letterSpacing: '2px' }}>{t.team_code}</code></td>
                    <td>
                      {t.participants?.length || 0}
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
                        {t.participants?.map((p: any) => p.full_name).join(', ')}
                      </div>
                    </td>
                    <td>{t.track || '–'}</td>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>No teams registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
