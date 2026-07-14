// ─── Database Types ────────────────────────────────────────────
export interface Team {
  id: string
  team_name: string
  team_code: string
  project_name: string | null
  track: string | null
  created_at: string
}

export interface Participant {
  id: string
  team_id: string
  full_name: string
  email: string
  grade: string
  is_team_leader: boolean
  qr_token: string
  checked_in: boolean
  checked_in_at: string | null
  created_at: string
  // Joined
  team?: Team
}

export interface Submission {
  id: string
  team_id: string
  project_name: string
  description: string
  github_url: string
  drive_url: string | null
  demo_url: string | null
  submitted_at: string
  updated_at: string
  // Joined
  team?: Team
}

export interface Judge {
  id: string
  name: string
  email: string
  role: 'core' | 'academics' | 'ot'
  created_at: string
}

export interface Score {
  id: string
  team_id: string
  judge_id: string
  innovation: number
  technical: number
  design: number
  impact: number
  presentation: number
  notes: string | null
  scored_at: string
  // Joined
  team?: Team
  judge?: Judge
}

// ─── Form Types ────────────────────────────────────────────────
export interface MemberForm {
  full_name: string
  email: string
  grade: string
}

export interface RegistrationForm {
  team_name: string
  members: MemberForm[]
}

export interface SubmissionForm {
  project_name: string
  description: string
  github_url: string
  drive_url: string
  demo_url: string
}

export interface ScoreForm {
  innovation: number
  technical: number
  design: number
  impact: number
  presentation: number
  notes: string
}

// ─── Leaderboard (legacy Gavel-era rubric — unused, kept for reference) ─
export interface TeamScore {
  team_id: string
  team_name: string
  project_name: string | null
  avg_innovation: number
  avg_technical: number
  avg_design: number
  avg_impact: number
  avg_presentation: number
  total_score: number
  judge_count: number
}

// ─── Criteria Scoring (points-based judging) ──────────────────
export interface CriteriaScore {
  id: string
  team_id: string
  judge_id: string
  relevance: number
  creativity: number
  functionality: number
  ux: number
  presentation: number
  code_quality: number
  completeness: number
  bonus_mvp: number
  bonus_api: number
  bonus_database: number
  bonus_auth: number
  bonus_original_assets: number
  notes: string | null
  scored_at: string
  updated_at: string
}

export interface CriteriaScoreForm {
  relevance: number
  creativity: number
  functionality: number
  ux: number
  presentation: number
  code_quality: number
  completeness: number
  bonus_mvp: number
  bonus_api: number
  bonus_database: number
  bonus_auth: number
  bonus_original_assets: number
  notes: string
}

export const CRITERIA_MAX = {
  relevance: 30,
  creativity: 25,
  functionality: 25,
  ux: 20,
  presentation: 20,
  code_quality: 15,
  completeness: 15,
} as const

export const BONUS_MAX = {
  bonus_mvp: 20,
  bonus_api: 20,
  bonus_database: 10,
  bonus_auth: 5,
  bonus_original_assets: 10,
} as const

export const CRITERIA_LABELS: Record<keyof typeof CRITERIA_MAX, string> = {
  relevance: 'Relevance to Challenge Topic',
  creativity: 'Creativity & Originality',
  functionality: 'Functionality',
  ux: 'User Experience / Playability',
  presentation: 'Presentation & Demo',
  code_quality: 'Code / Design Quality',
  completeness: 'Completeness',
}

export const BONUS_LABELS: Record<keyof typeof BONUS_MAX, string> = {
  bonus_mvp: 'Fully Functional MVP',
  bonus_api: 'Real-World API Use',
  bonus_database: 'Database / Local Storage',
  bonus_auth: 'Authentication System',
  bonus_original_assets: 'Original Assets',
}

// ─── Side Quests ───────────────────────────────────────────────
export interface SideQuest {
  id: string
  title: string
  description: string
  points: number
  status: 'draft' | 'open' | 'closed'
  created_by: string | null
  created_at: string
  opened_at: string | null
  closed_at: string | null
}

export interface SideQuestSubmission {
  id: string
  quest_id: string
  team_id: string
  submitted_by: string | null
  response_text: string
  response_link: string | null
  verdict: 'pending' | 'correct' | 'incorrect'
  graded_by: string | null
  graded_at: string | null
  submitted_at: string
  updated_at: string
  // Joined
  team?: Team
  quest?: SideQuest
}

// ─── Points-System Leaderboard ─────────────────────────────────
export type LeaderboardPool = 'app_web' | 'game_dev'
export type LeaderboardCategory = 'Junior' | 'Senior'

export interface LeaderboardEntry {
  rank: number
  team_id: string
  team_name: string
  project_name: string | null
  track: 'App Dev' | 'Web Dev' | 'Game Dev'
  pool: LeaderboardPool
  category: LeaderboardCategory
  judge_count: number
  side_quest_points: number
  total_score: number
}

export interface AdminLeaderboardEntry extends LeaderboardEntry {
  avg_relevance: number
  avg_creativity: number
  avg_functionality: number
  avg_ux: number
  avg_presentation: number
  avg_code_quality: number
  avg_completeness: number
  avg_bonus_mvp: number
  avg_bonus_api: number
  avg_bonus_database: number
  avg_bonus_auth: number
  avg_bonus_original_assets: number
  criteria_total: number
  bonus_total: number
}
