'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { MAX_TEAM_SIZE } from '@/lib/types'
import { categoryFromGrades } from '@/lib/leaderboard'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const selectCls = 'rounded-lg border border-line bg-panel/60 px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-brand disabled:opacity-50'
const inputCls = 'rounded-lg border border-line bg-panel/60 px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-brand disabled:opacity-50'
const smBtn = 'rounded-lg px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] transition-colors'
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']

export default function AdminTeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [editingTeamName, setEditingTeamName] = useState<string | null>(null)
  const [teamNameDraft, setTeamNameDraft] = useState('')
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [participantDraft, setParticipantDraft] = useState({ full_name: '', grade: '' })
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})

  const loadTeams = async () => {
    const supabase = createClient()
    const { data: teamsData } = await supabase
      .from('teams').select('*, participants(*)')
      .eq('participants.approval_status', 'approved')
      .order('created_at', { ascending: false })
    setTeams(teamsData || [])
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      await loadTeams()
      setLoading(false)
    }
    load()
  }, [router])

  const updateTrack = async (teamId: string, track: string) => {
    setBusy(teamId)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: track || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to update track.')
    }
    setBusy(null)
  }

  const saveTeamName = async (teamId: string) => {
    if (!teamNameDraft.trim()) { setEditingTeamName(null); return }
    setBusy(teamId)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_name: teamNameDraft.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setEditingTeamName(null)
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to rename team.')
    }
    setBusy(null)
  }

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Delete "${teamName}" entirely? This removes every member, their submission, scores, and side-quest history. This cannot be undone.`)) return
    setBusy(teamId)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      if (expandedId === teamId) setExpandedId(null)
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to delete team.')
    }
    setBusy(null)
  }

  const startEditParticipant = (p: any) => {
    setEditingParticipantId(p.id)
    setParticipantDraft({ full_name: p.full_name, grade: p.grade })
  }

  const saveParticipant = async (participantId: string) => {
    setBusy(participantId)
    try {
      const res = await fetch(`/api/admin/participants/${participantId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(participantDraft),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setEditingParticipantId(null)
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to update participant.')
    }
    setBusy(null)
  }

  const removeParticipant = async (participantId: string, name: string) => {
    if (!confirm(`Delete ${name}'s registration entirely — including their account, so they could sign up again with the same email? This cannot be undone.`)) return
    setBusy(participantId)
    try {
      const res = await fetch(`/api/admin/participants/${participantId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to remove participant.')
    }
    setBusy(null)
  }

  const moveParticipant = async (participantId: string, name: string) => {
    const targetTeamId = moveTarget[participantId]
    if (!targetTeamId) return
    const targetTeam = teams.find((t) => t.id === targetTeamId)
    if (!confirm(`Move ${name} to "${targetTeam?.team_name}"?`)) return
    setBusy(participantId)
    try {
      const res = await fetch(`/api/admin/participants/${participantId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_id: targetTeamId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setMoveTarget((prev) => ({ ...prev, [participantId]: '' }))
      await loadTeams()
    } catch (err: any) {
      alert(err.message || 'Failed to move participant.')
    }
    setBusy(null)
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
          <p className="text-sm text-ink-sub">Full control — rename, retrack, edit members, or delete anything</p>
        </div>

        <div className="flex flex-col gap-3">
          {teams.map((t) => (
            <div key={t.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editingTeamName === t.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus className={inputCls} value={teamNameDraft} onChange={(e) => setTeamNameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveTeamName(t.id)} disabled={busy === t.id} />
                      <button onClick={() => saveTeamName(t.id)} disabled={busy === t.id} className={`${smBtn} border border-good/40 text-good`}>Save</button>
                      <button onClick={() => setEditingTeamName(null)} className={`${smBtn} border border-line text-ink-dim`}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingTeamName(t.id); setTeamNameDraft(t.team_name) }}
                      className="group flex items-center gap-2 text-left font-display text-base font-bold text-ink hover:text-brand">
                      {t.team_name}
                      <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-dim opacity-0 group-hover:opacity-100">edit ✎</span>
                    </button>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                    <span className="font-mono tracking-[0.2em] text-brand">{t.team_code}</span>
                    <span>· {t.participants?.length || 0}/{MAX_TEAM_SIZE} members</span>
                    <span>· registered {new Date(t.created_at).toLocaleDateString()}</span>
                    {categoryFromGrades((t.participants || []).map((p: any) => p.grade)) && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-brand">
                        {categoryFromGrades((t.participants || []).map((p: any) => p.grade))}
                      </span>
                    )}
                  </div>
                </div>

                <select className={selectCls} value={t.track || ''} disabled={busy === t.id} onChange={(e) => updateTrack(t.id, e.target.value)}>
                  <option value="">No Track (Junior)</option>
                  <option value="App/Web Dev">App/Web Dev</option>
                  <option value="Game Dev">Game Dev</option>
                </select>

                <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className={`${smBtn} border border-line text-ink-sub hover:text-ink`}>
                  {expandedId === t.id ? 'Hide Members' : 'Members'}
                </button>
                <button onClick={() => deleteTeam(t.id, t.team_name)} disabled={busy === t.id} className={`${smBtn} border border-bad/40 text-bad hover:bg-bad/10`}>Delete Team</button>
              </div>

              {expandedId === t.id && (
                <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-line pt-4">
                  {(t.participants || []).map((p: any) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-base/40 px-3 py-2.5">
                      {editingParticipantId === p.id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input className={inputCls} value={participantDraft.full_name} onChange={(e) => setParticipantDraft((d) => ({ ...d, full_name: e.target.value }))} />
                          <select className={selectCls} value={participantDraft.grade} onChange={(e) => setParticipantDraft((d) => ({ ...d, grade: e.target.value }))}>
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <button onClick={() => saveParticipant(p.id)} disabled={busy === p.id} className={`${smBtn} border border-good/40 text-good`}>Save</button>
                          <button onClick={() => setEditingParticipantId(null)} className={`${smBtn} border border-line text-ink-dim`}>✕</button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-ink">
                              {p.full_name}
                              {p.is_team_leader && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-brand">Leader</span>}
                              {p.checked_in && <span className="rounded-full bg-good/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-good">Checked In</span>}
                            </span>
                            <span className="truncate text-xs text-ink-dim">{p.grade} · {p.email}</span>
                          </div>
                          <select className={selectCls} value={moveTarget[p.id] || ''} disabled={busy === p.id}
                            onChange={(e) => setMoveTarget((prev) => ({ ...prev, [p.id]: e.target.value }))}>
                            <option value="">Move to…</option>
                            {teams.filter((ot) => ot.id !== t.id).map((ot) => (
                              <option key={ot.id} value={ot.id} disabled={(ot.participants?.length || 0) >= MAX_TEAM_SIZE}>
                                {ot.team_name} ({ot.participants?.length || 0}/{MAX_TEAM_SIZE}{(ot.participants?.length || 0) >= MAX_TEAM_SIZE ? ' · full' : ''})
                              </option>
                            ))}
                          </select>
                          <button onClick={() => moveParticipant(p.id, p.full_name)} disabled={busy === p.id || !moveTarget[p.id]} className={`${smBtn} border border-brand/40 text-brand hover:bg-brand/5`}>Move</button>
                          <button onClick={() => startEditParticipant(p)} className={`${smBtn} border border-line text-ink-sub hover:text-ink`}>Edit</button>
                          <button onClick={() => removeParticipant(p.id, p.full_name)} disabled={busy === p.id} className={`${smBtn} border border-bad/40 text-bad hover:bg-bad/10`}>Delete</button>
                        </>
                      )}
                    </div>
                  ))}
                  {(t.participants || []).length === 0 && <p className="text-sm text-ink-dim">No members left on this team.</p>}
                </div>
              )}
            </div>
          ))}
          {teams.length === 0 && <p className={`${card} text-center text-sm text-ink-dim`}>No teams registered yet</p>}
        </div>
      </main>
    </div>
  )
}
