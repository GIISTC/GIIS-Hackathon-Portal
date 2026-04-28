'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import styles from '../page.module.css'

export default function AdminSubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<any[]>([])
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

      const { data: subData } = await supabase
        .from('submissions')
        .select('*, team:teams(team_name)')
        .order('submitted_at', { ascending: false })
      setSubmissions(subData || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className={styles.adminWrapper}>
        <AdminNav active="submissions" adminName={adminName} />
        <main className={styles.adminMain}>
          <div className="loading-overlay"><div className="spinner" /><span>Loading submissions...</span></div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.adminWrapper}>
      <AdminNav active="submissions" adminName={adminName} />
      <main className={styles.adminMain}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Project Submissions</h1>
            <p className={styles.pageSub}>Browse and review all project submissions</p>
          </div>
        </div>

        <div className={`card ${styles.tableCard}`}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Project Name</th>
                  <th>Links</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{s.team?.team_name}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.project_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.description}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {s.github_url && <a href={s.github_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>GitHub</a>}
                        {s.drive_url && <a href={s.drive_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Drive</a>}
                        {s.demo_url && <a href={s.demo_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Demo</a>}
                      </div>
                    </td>
                    <td>{new Date(s.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>No submissions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
