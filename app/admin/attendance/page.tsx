'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { EVENT_DAYS } from '@/lib/types'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'rounded-lg border border-line bg-panel/60 px-3 py-2 font-body text-sm text-ink outline-none focus:border-brand'

export default function AdminAttendancePage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [judgeId, setJudgeId] = useState('')
  const [participants, setParticipants] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadData = async () => {
    const supabase = createClient()
    const { data: parts } = await supabase
      .from('participants').select('*, team:teams(team_name)').order('full_name')
    const { data: cins } = await supabase.from('checkins').select('*')
    setParticipants(parts || [])
    setCheckins(cins || [])
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      setJudgeId(judge.id)
      await loadData()
      setLoading(false)
    }
    load()
  }, [router])

  const checkinMap = useMemo(() => {
    const m = new Map<string, Record<number, any>>()
    for (const c of checkins) {
      if (!m.has(c.participant_id)) m.set(c.participant_id, {})
      m.get(c.participant_id)![c.event_day] = c
    }
    return m
  }, [checkins])

  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const d of EVENT_DAYS) counts[d.day] = checkins.filter((c) => c.event_day === d.day).length
    return counts
  }, [checkins])

  const filtered = participants.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return p.full_name?.toLowerCase().includes(q) || p.team?.team_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
  })

  const toggleDay = async (participantId: string, day: number, isCheckedIn: boolean) => {
    const key = `${participantId}-${day}`
    setBusy(key)
    try {
      const supabase = createClient()
      if (isCheckedIn) {
        const { error } = await supabase.from('checkins').delete().eq('participant_id', participantId).eq('event_day', day)
        if (error) throw error
      } else {
        const { error } = await supabase.from('checkins').insert({ participant_id: participantId, event_day: day, checked_in_by: judgeId })
        if (error) throw error
        await supabase.from('participants').update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq('id', participantId)
      }
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to update attendance.')
    }
    setBusy(null)
  }

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="attendance" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading attendance…
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="attendance" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Attendance</h1>
            <p className="text-sm text-ink-sub">Full participant roster — check-in status for each event day</p>
          </div>
          <input
            className={inputCls}
            placeholder="Search name, team, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className={card}>
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">Total Participants</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">{participants.length}</div>
          </div>
          {EVENT_DAYS.map((d) => (
            <div key={d.day} className={card}>
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">{d.label} · {d.date}</div>
              <div className="mt-1 font-display text-2xl font-bold text-good">{dayCounts[d.day] || 0}<span className="text-sm font-normal text-ink-dim"> / {participants.length}</span></div>
            </div>
          ))}
        </div>

        <div className={card}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-dim">
                  <th className="py-2 pr-3">Participant</th>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 pr-3">Grade</th>
                  {EVENT_DAYS.map((d) => (
                    <th key={d.day} className="py-2 pr-3 text-center">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const days = checkinMap.get(p.id) || {}
                  return (
                    <tr key={p.id} className="border-b border-line-soft last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-ink">{p.full_name}</div>
                        <div className="text-xs text-ink-dim">{p.email}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-sub">{p.team?.team_name || '—'}</td>
                      <td className="py-2.5 pr-3 text-ink-sub">{p.grade}</td>
                      {EVENT_DAYS.map((d) => {
                        const rec = days[d.day]
                        const key = `${p.id}-${d.day}`
                        return (
                          <td key={d.day} className="py-2.5 pr-3 text-center">
                            <button
                              onClick={() => toggleDay(p.id, d.day, !!rec)}
                              disabled={busy === key}
                              title={rec ? `Checked in at ${new Date(rec.checked_in_at).toLocaleTimeString()}` : `Mark checked in for ${d.label}`}
                              className={`rounded-full px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] transition-colors ${
                                rec ? 'bg-good/15 text-good hover:bg-bad/15 hover:text-bad' : 'border border-line text-ink-dim hover:border-brand/50 hover:text-brand'
                              } disabled:opacity-50`}
                            >
                              {rec ? '✓ Checked In' : 'Mark In'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3 + EVENT_DAYS.length} className="py-10 text-center text-sm text-ink-dim">No participants match your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
