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

// ─── Leaderboard ───────────────────────────────────────────────
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
