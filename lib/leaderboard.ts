import {
  CRITERIA_MAX,
  BONUS_MAX,
  type AdminLeaderboardEntry,
  type LeaderboardPool,
  type LeaderboardCategory,
} from '@/lib/types'

const CRITERIA_KEYS = Object.keys(CRITERIA_MAX) as (keyof typeof CRITERIA_MAX)[]
const BONUS_KEYS = Object.keys(BONUS_MAX) as (keyof typeof BONUS_MAX)[]

// A single grade string ("Grade 9") -> Junior (6-8) or Senior (9-12).
export function gradeToCategory(grade: string): LeaderboardCategory | null {
  const m = /grade\s*(\d+)/i.exec(grade)
  if (!m) return null
  return parseInt(m[1], 10) <= 8 ? 'Junior' : 'Senior'
}

// Highest grade on the team decides the category (rulebook rule for mixed-grade teams).
export function categoryFromGrades(grades: string[]): LeaderboardCategory | null {
  const cats = grades.map(gradeToCategory).filter((c): c is LeaderboardCategory => c !== null)
  if (cats.length === 0) return null
  return cats.includes('Senior') ? 'Senior' : 'Junior'
}

export type LeaderboardResult = {
  // Juniors have no track (build anything) so they rank on one combined
  // leaderboard. Seniors must pick one of the 2 tracks, so they're split
  // into pools.
  junior: AdminLeaderboardEntry[]
  senior: Record<LeaderboardPool, AdminLeaderboardEntry[]>
  updatedAt: string
}

// Computes the full points breakdown (incl. secret bonus fields) for every
// team. Callers that serve participants MUST strip bonus-derived fields
// before responding — this function itself does not hide anything, it's
// meant for OT-only or server-internal use (see app/api/leaderboard/route.ts
// for the public cut).
export async function computeLeaderboard(supabase: any): Promise<LeaderboardResult> {
  const [{ data: teams }, { data: submissions }, { data: scores }, { data: questSubs }] = await Promise.all([
    supabase.from('teams').select('id, team_name, track, participants(grade)'),
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

  const junior: AdminLeaderboardEntry[] = []
  const senior: Record<LeaderboardPool, AdminLeaderboardEntry[]> = { app_web: [], game_dev: [] }

  for (const team of teams || []) {
    const grades = (team.participants || []).map((p: any) => p.grade).filter(Boolean)
    const category = categoryFromGrades(grades)
    if (!category) continue // no participants with a parseable grade — exclude from ranking

    // Seniors must have picked one of the 2 tracks to be poolable; if OT
    // hasn't set one yet, hold the team out of the ranked leaderboard
    // rather than guessing a pool for them.
    let pool: LeaderboardPool | null = null
    if (category === 'Senior') {
      if (team.track !== 'App/Web Dev' && team.track !== 'Game Dev') continue
      pool = team.track === 'Game Dev' ? 'game_dev' : 'app_web'
    }

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
      track: category === 'Senior' ? team.track : null,
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

    if (category === 'Junior') junior.push(entry)
    else senior[pool!].push(entry)
  }

  junior.sort((a, b) => b.total_score - a.total_score)
  junior.forEach((entry, i) => { entry.rank = i + 1 })

  for (const pool of Object.keys(senior) as LeaderboardPool[]) {
    senior[pool].sort((a, b) => b.total_score - a.total_score)
    senior[pool].forEach((entry, i) => { entry.rank = i + 1 })
  }

  return { junior, senior, updatedAt: new Date().toISOString() }
}
