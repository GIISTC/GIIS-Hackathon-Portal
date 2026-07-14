'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'

export default function AdminTeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [updatingTrack, setUpdatingTrack] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)

      const { data: teamsData } = await supabase
        .from('teams').select('*, participants(*)').order('created_at', { ascending: false })
      setTeams(teamsData || [])
      setLoading(false)
    }
    load()
  }, [router])

  const updateTrack = async (teamId: string, track: string) => {
    setUpdatingTrack(teamId)
    const supabase = createClient()
    const { error } = await supabase.from('teams').update({ track }).eq('id', teamId)
    if (!error) setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, track } : t)))
    setUpdatingTrack(null)
  }

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="teams" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading teams…
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="teams" adminName={adminName} />
      <main className={main}>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Manage Teams</h1>
          <p className="text-sm text-ink-sub">View all registered teams and participants</p>
        </div>

        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  {['Team Name', 'Team Code', 'Members', 'Track', 'Registered'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-line-soft align-top last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{t.team_name}</td>
                    <td className="px-3 py-3 font-mono tracking-[0.2em] text-brand">{t.team_code}</td>
                    <td className="px-3 py-3">
                      <span className="text-ink">{t.participants?.length || 0}</span>
                      <div className="mt-1 text-xs text-ink-dim">{t.participants?.map((p: any) => p.full_name).join(', ')}</div>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="rounded-lg border border-line bg-panel/60 px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-brand disabled:opacity-50"
                        value={t.track || ''}
                        disabled={updatingTrack === t.id}
                        onChange={(e) => updateTrack(t.id, e.target.value)}
                      >
                        <option value="" disabled>Not set</option>
                        <option value="App Dev">App Dev</option>
                        <option value="Web Dev">Web Dev</option>
                        <option value="Game Dev">Game Dev</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 text-ink-sub">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-dim">No teams registered yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
