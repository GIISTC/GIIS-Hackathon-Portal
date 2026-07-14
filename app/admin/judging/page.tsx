'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { categoryFromGrades } from '@/lib/leaderboard'
import {
  CRITERIA_MAX, CRITERIA_LABELS, BONUS_MAX, BONUS_LABELS,
  type CriteriaScoreForm, type AdminLeaderboardEntry, type LeaderboardPool, type LeaderboardCategory,
} from '@/lib/types'

const CRITERIA_KEYS = Object.keys(CRITERIA_MAX) as (keyof typeof CRITERIA_MAX)[]
const BONUS_KEYS = Object.keys(BONUS_MAX) as (keyof typeof BONUS_MAX)[]

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const inputCls = 'w-full rounded-lg border border-line bg-panel/60 px-3 py-2.5 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand'
const labelCls = 'mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand'

const emptyForm = (): CriteriaScoreForm => ({
  relevance: 0, creativity: 0, functionality: 0, ux: 0, presentation: 0, code_quality: 0, completeness: 0,
  bonus_mvp: 0, bonus_api: 0, bonus_database: 0, bonus_auth: 0, bonus_original_assets: 0, notes: '',
})

export default function JudgingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [isOT, setIsOT] = useState(false)

  const [view, setView] = useState<'score' | 'leaderboard'>('score')
  const [teams, setTeams] = useState<any[]>([])
  const [myScoredTeamIds, setMyScoredTeamIds] = useState<Set<string>>(new Set())
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [form, setForm] = useState<CriteriaScoreForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [poolFilter, setPoolFilter] = useState<'all' | LeaderboardPool>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | LeaderboardCategory>('all')

  const [leaderboard, setLeaderboard] = useState<Record<LeaderboardPool, Record<LeaderboardCategory, AdminLeaderboardEntry[]>> | null>(null)
  const [lbLoading, setLbLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      setIsOT(judge.role === 'ot')
      if (judge.role === 'ot') await Promise.all([loadTeams(), loadMyScores(user.id)])
      setLoading(false)
    }
    init()
  }, [router])

  const loadTeams = async () => {
    const supabase = createClient()
    const [{ data: teamsData }, { data: subsData }] = await Promise.all([
      supabase.from('teams').select('*, participants(grade)').not('track', 'is', null).order('team_name'),
      supabase.from('submissions').select('team_id, project_name'),
    ])
    const subByTeam = new Map((subsData || []).map((s: any) => [s.team_id, s.project_name]))
    setTeams((teamsData || []).map((t: any) => ({ ...t, project_name: subByTeam.get(t.id) || null })))
  }

  const loadMyScores = async (judgeId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('criteria_scores').select('team_id').eq('judge_id', judgeId)
    setMyScoredTeamIds(new Set((data || []).map((s: any) => s.team_id)))
  }

  const selectTeam = async (teamId: string) => {
    setSelectedTeamId(teamId)
    setSaveMsg(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase
      .from('criteria_scores').select('*').eq('team_id', teamId).eq('judge_id', user!.id).maybeSingle()

    if (existing) {
      setForm({
        relevance: existing.relevance, creativity: existing.creativity, functionality: existing.functionality,
        ux: existing.ux, presentation: existing.presentation, code_quality: existing.code_quality, completeness: existing.completeness,
        bonus_mvp: existing.bonus_mvp, bonus_api: existing.bonus_api, bonus_database: existing.bonus_database,
        bonus_auth: existing.bonus_auth, bonus_original_assets: existing.bonus_original_assets, notes: existing.notes || '',
      })
    } else {
      setForm(emptyForm())
    }
  }

  const updateNumberField = (key: keyof typeof CRITERIA_MAX | keyof typeof BONUS_MAX, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/[^0-9]/g, '')
      let value = digits === '' ? 0 : parseInt(digits, 10)
      if (Number.isNaN(value)) value = 0
      value = Math.max(0, Math.min(max, value))
      setForm((prev) => ({ ...prev, [key]: value }))
    }

  const updateNotes = (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((prev) => ({ ...prev, notes: e.target.value }))

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/judge/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: selectedTeamId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaveMsg('✓ Score saved.')
      setMyScoredTeamIds((prev) => new Set(prev).add(selectedTeamId))
    } catch (err: any) {
      setSaveMsg(err.message || 'Failed to save score.')
    }
    setSaving(false)
  }

  const loadLeaderboard = async () => {
    setView('leaderboard')
    setLbLoading(true)
    try {
      const res = await fetch('/api/admin/leaderboard')
      const data = await res.json()
      if (res.ok) setLeaderboard(data.pools)
    } catch {}
    setLbLoading(false)
  }

  const teamPool = (team: any): LeaderboardPool => (team.track === 'Game Dev' ? 'game_dev' : 'app_web')
  const teamCategory = (team: any) => categoryFromGrades((team.participants || []).map((p: any) => p.grade))

  const filteredTeams = teams.filter((t) => {
    if (poolFilter !== 'all' && teamPool(t) !== poolFilter) return false
    if (categoryFilter !== 'all' && teamCategory(t) !== categoryFilter) return false
    return true
  })

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const filterSelect = 'flex-1 rounded-lg border border-line bg-panel/60 px-2.5 py-2 font-body text-sm text-ink outline-none focus:border-brand'

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="judging" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading…
          </div>
        </main>
      </div>
    )
  }

  if (!isOT) {
    return (
      <div className={shell}>
        <AdminNav active="judging" adminName={adminName} />
        <main className={main}>
          <div className={`${card} flex flex-col items-center gap-3 py-16 text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-warn">Restricted</div>
            <h2 className="font-display text-xl font-bold text-ink">OT Access Only</h2>
            <p className="max-w-md text-ink-sub">Project scoring is restricted to OT (Organizing Team) members. If you believe this is a mistake, contact an OT lead.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="judging" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Project Judging</h1>
            <p className="text-sm text-ink-sub">Score projects against the official rubric — OT only</p>
          </div>
          <div className="flex gap-2">
            {(['score', 'leaderboard'] as const).map((v) => (
              <button key={v} onClick={() => (v === 'leaderboard' ? loadLeaderboard() : setView('score'))}
                className={`rounded-lg px-4 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] transition-colors ${
                  view === v ? 'bg-gradient-to-br from-brand to-brand-blue text-base' : 'border border-line text-brand hover:bg-brand/5'
                }`}>
                {v === 'score' ? 'Score' : 'Leaderboard'}
              </button>
            ))}
          </div>
        </div>

        {view === 'score' && (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            {/* Team list */}
            <div className={card}>
              <h2 className="font-display text-base font-bold text-ink">Teams</h2>
              <div className="my-3 flex gap-2">
                <select className={filterSelect} value={poolFilter} onChange={(e) => setPoolFilter(e.target.value as any)}>
                  <option value="all">All Pools</option>
                  <option value="app_web">App / Web</option>
                  <option value="game_dev">Game Dev</option>
                </select>
                <select className={filterSelect} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}>
                  <option value="all">All</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>
              <div className="flex max-h-[600px] flex-col gap-1.5 overflow-y-auto">
                {filteredTeams.map((t) => (
                  <button key={t.id} onClick={() => selectTeam(t.id)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selectedTeamId === t.id ? 'border-brand/40 bg-brand/10' : 'border-line-soft bg-base/40 hover:border-line'
                    }`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{t.team_name}</span>
                      <span className="block truncate text-xs text-ink-dim">{t.project_name || 'No submission yet'}</span>
                    </span>
                    {myScoredTeamIds.has(t.id) && <span className="shrink-0 text-good">✓</span>}
                  </button>
                ))}
                {filteredTeams.length === 0 && <p className="py-5 text-center text-sm text-ink-dim">No teams match this filter.</p>}
              </div>
            </div>

            {/* Score form */}
            <div className={card}>
              {!selectedTeam ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-dim">
                  <h2 className="font-display text-lg font-bold text-ink">Select a team to score</h2>
                  <p className="text-sm">Choose a team from the list to open its scorecard.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitScore}>
                  <div className="mb-4">
                    <h2 className="font-display text-xl font-bold text-ink">{selectedTeam.team_name}</h2>
                    <p className="text-sm text-ink-sub">{selectedTeam.project_name || 'No submission yet'} · {selectedTeam.track} · {teamCategory(selectedTeam) || '—'}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {CRITERIA_KEYS.map((key) => (
                      <div key={key}>
                        <label className={labelCls}>{CRITERIA_LABELS[key]} <span className="text-ink-dim">/ {CRITERIA_MAX[key]}</span></label>
                        <input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                          value={form[key] === 0 ? '' : form[key]} onChange={updateNumberField(key, CRITERIA_MAX[key])} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <label className={labelCls}>Notes <span className="text-ink-dim normal-case tracking-normal">(optional)</span></label>
                    <textarea className={`${inputCls} min-h-[80px]`} value={form.notes} onChange={updateNotes} placeholder="Private notes for your own reference" />
                  </div>

                  <div className="mt-5 border-t border-dashed border-line pt-4">
                    <div className="mb-3">
                      <span className="inline-block rounded-full bg-warn/15 px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide text-warn">Internal · OT-Only</span>
                      <p className="mt-1.5 text-xs text-ink-dim">Bonus points are never shown to participants — they&apos;re folded silently into the leaderboard total.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {BONUS_KEYS.map((key) => (
                        <div key={key}>
                          <label className={labelCls}>{BONUS_LABELS[key]} <span className="text-ink-dim">/ {BONUS_MAX[key]}</span></label>
                          <input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                            value={form[key] === 0 ? '' : form[key]} onChange={updateNumberField(key, BONUS_MAX[key])} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {saveMsg && (
                    <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${saveMsg.startsWith('✓') ? 'border-good/30 bg-good/10 text-good' : 'border-bad/30 bg-bad/10 text-[#fca5a5]'}`}>
                      {saveMsg}
                    </div>
                  )}

                  <button type="submit" disabled={saving}
                    className="mt-4 w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
                    {saving ? 'Saving…' : myScoredTeamIds.has(selectedTeamId!) ? 'Update Score' : 'Save Score'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {view === 'leaderboard' && (
          <div className={card}>
            {lbLoading || !leaderboard ? (
              <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
            ) : (
              (['app_web', 'game_dev'] as const).map((pool) => (
                <div key={pool} className="mb-6 last:mb-0">
                  <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-brand">{pool === 'app_web' ? 'App / Web Dev' : 'Game Dev'}</h2>
                  {(['Junior', 'Senior'] as const).map((category) => (
                    <div key={category} className="mb-4">
                      <h3 className="mb-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink-dim">{category}</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
                          <thead>
                            <tr className="border-b border-line text-left">
                              {['Rank', 'Team', 'Project', 'Criteria', 'Bonus', 'Side Q', 'Total', 'Judges'].map((h) => (
                                <th key={h} className="px-3 py-2 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink-dim">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {leaderboard[pool][category].map((e, i) => (
                              <tr key={e.team_id} className="border-b border-line-soft last:border-0">
                                <td className={`px-3 py-2.5 font-mono font-bold ${i < 3 ? 'text-brand' : 'text-ink-dim'}`}>#{e.rank}</td>
                                <td className="px-3 py-2.5 font-semibold text-ink">{e.team_name}</td>
                                <td className="px-3 py-2.5 text-ink-sub">{e.project_name || '–'}</td>
                                <td className="px-3 py-2.5 text-ink-sub">{e.criteria_total.toFixed(1)}</td>
                                <td className="px-3 py-2.5 text-warn">{e.bonus_total.toFixed(1)}</td>
                                <td className="px-3 py-2.5 text-ink-sub">{e.side_quest_points}</td>
                                <td className="px-3 py-2.5 font-mono font-bold text-brand-blue">{e.total_score.toFixed(1)}</td>
                                <td className="px-3 py-2.5 text-ink-sub">{e.judge_count}</td>
                              </tr>
                            ))}
                            {leaderboard[pool][category].length === 0 && (
                              <tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-ink-dim">No teams yet</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
