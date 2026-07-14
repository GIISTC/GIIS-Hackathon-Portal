import {
  CRITERIA_MAX,
  BONUS_MAX,
  type AdminLeaderboardEntry,
  type LeaderboardPool,
  type LeaderboardCategory,
} from '@/lib/types'

const CRITERIA_KEYS = Object.keys(CRITERIA_MAX) as (keyof typeof CRITERIA_MAX)[]
const BONUS_KEYS = Object.keys(BONUS_MAX) as (keyof typeof BONUS_MAX)[]

// Highest grade on the team decides the category (rulebook rule for mixed-grade teams).
export function categoryFromGrades(grades: string[]): LeaderboardCategory | null {
  const nums = grades
    .map(g => {
      const m = /grade\s*(\d+)/i.exec(g)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n): n is number => n !== null)
  if (nums.length === 0) return null
  return Math.max(...nums) <= 8 ? 'Junior' : 'Senior'
}

export type LeaderboardResult = {
  pools: Record<LeaderboardPool, Record<LeaderboardCategory, AdminLeaderboardEntry[]>>
  updatedAt: string
}

// Computes the full points breakdown (incl. secret bonus fields) for every
// team, grouped into the 4 pool x category leaderboards. Callers that serve
// participants MUST strip bonus-derived fields before responding — this
// function itself does not hide anything, it's meant for OT-only or
// server-internal use (see app/api/leaderboard/route.ts for the public cut).
export async function computeLeaderboard(supabase: any): Promise<LeaderboardResult> {
  const [{ data: teams }, { data: submissions }, { data: scores }, { data: questSubs }] = await Promise.all([
    supabase.from('teams').select('id, team_name, track, participants(grade)').not('track', 'is', null),
    supabase.from('submissions').select('team_id, project_name'),
    supabase.from('criteria_scores').select('*'),
    supabase.from('side_quest_submissions').select('team_id, verdict, quest:side_quests(points)').eq('verdict', 'correct'),
  ])

  const submissionByTeam = new Map<string, string | null>()
  ;(submissions || []).forEach((s: any) => submissionByTeam.set(s.team_id, s.project_name))

  const scoresByTeam = new Map<string, any[]>()
  ;(scores || []).forEach((s: any) => {
    if (!scoresByTeam.has(s.team_id)) scoresByTeam.set(s.team_id, [])
    scoresByTeam.get(s.team_id)!.push(s)
  })

  const questPointsByTeam = new Map<string, number>()
  ;(questSubs || []).forEach((qs: any) => {
    const pts = qs.quest?.points || 0
    questPointsByTeam.set(qs.team_id, (questPointsByTeam.get(qs.team_id) || 0) + pts)
  })

  const pools: LeaderboardResult['pools'] = {
    app_web: { Junior: [], Senior: [] },
    game_dev: { Junior: [], Senior: [] },
  }

  for (const team of teams || []) {
    const grades = (team.participants || []).map((p: any) => p.grade).filter(Boolean)
    const category = categoryFromGrades(grades)
    if (!category) continue // no participants with a parseable grade — exclude from ranking

    const track = team.track as 'App Dev' | 'Web Dev' | 'Game Dev'
    const pool: LeaderboardPool = track === 'Game Dev' ? 'game_dev' : 'app_web'

    const judgeScores = scoresByTeam.get(team.id) || []
    const judgeCount = judgeScores.length
    const avg = (key: string) =>
      judgeCount === 0 ? 0 : judgeScores.reduce((sum, s) => sum + (s[key] || 0), 0) / judgeCount

    let criteriaTotal = 0
    const criteriaAvgs: Record<string, number> = {}
    for (const key of CRITERIA_KEYS) {
      const v = avg(key)
      criteriaAvgs[key] = v
      criteriaTotal += v
    }

    let bonusTotal = 0
    const bonusAvgs: Record<string, number> = {}
    for (const key of BONUS_KEYS) {
      const v = avg(key)
      bonusAvgs[key] = v
      bonusTotal += v
    }

    const sideQuestPoints = questPointsByTeam.get(team.id) || 0

    const entry: AdminLeaderboardEntry = {
      rank: 0,
      team_id: team.id,
      team_name: team.team_name,
      project_name: submissionByTeam.get(team.id) ?? null,
      track,
      pool,
      category,
      judge_count: judgeCount,
      side_quest_points: sideQuestPoints,
      total_score: criteriaTotal + bonusTotal + sideQuestPoints,
      avg_relevance: criteriaAvgs.relevance,
      avg_creativity: criteriaAvgs.creativity,
      avg_functionality: criteriaAvgs.functionality,
      avg_ux: criteriaAvgs.ux,
      avg_presentation: criteriaAvgs.presentation,
      avg_code_quality: criteriaAvgs.code_quality,
      avg_completeness: criteriaAvgs.completeness,
      avg_bonus_mvp: bonusAvgs.bonus_mvp,
      avg_bonus_api: bonusAvgs.bonus_api,
      avg_bonus_database: bonusAvgs.bonus_database,
      avg_bonus_auth: bonusAvgs.bonus_auth,
      avg_bonus_original_assets: bonusAvgs.bonus_original_assets,
      criteria_total: criteriaTotal,
      bonus_total: bonusTotal,
    }

    pools[pool][category].push(entry)
  }

  for (const pool of Object.keys(pools) as LeaderboardPool[]) {
    for (const category of Object.keys(pools[pool]) as LeaderboardCategory[]) {
      pools[pool][category].sort((a, b) => b.total_score - a.total_score)
      pools[pool][category].forEach((entry, i) => { entry.rank = i + 1 })
    }
  }

  return { pools, updatedAt: new Date().toISOString() }
}
