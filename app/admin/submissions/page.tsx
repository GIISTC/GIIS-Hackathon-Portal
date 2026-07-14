'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const linkBtn = 'rounded-md border border-line px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5'

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
        .from('submissions').select('*, team:teams(team_name)').order('submitted_at', { ascending: false })
      setSubmissions(subData || [])
      setLoading(false)
    }
    load()
  }, [router])

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
          <p className="text-sm text-ink-sub">Browse and review all project submissions</p>
        </div>

        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Team', 'Project', 'Links', 'Submitted'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-line-soft align-top last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{s.team?.team_name}</td>
                    <td className="max-w-xs px-3 py-3">
                      <div className="font-medium text-ink">{s.project_name}</div>
                      <div className="truncate text-xs text-ink-dim">{s.description}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {s.github_url && <a href={s.github_url} target="_blank" rel="noreferrer" className={linkBtn}>GitHub</a>}
                        {s.drive_url && <a href={s.drive_url} target="_blank" rel="noreferrer" className={linkBtn}>Drive</a>}
                        {s.demo_url && <a href={s.demo_url} target="_blank" rel="noreferrer" className={linkBtn}>Demo</a>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-sub">{new Date(s.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-ink-dim">No submissions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
