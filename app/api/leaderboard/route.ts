import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeLeaderboard } from '@/lib/leaderboard'
import type { LeaderboardEntry, LeaderboardPool, LeaderboardCategory } from '@/lib/types'

// This route uses no cookies/headers, so Next.js would otherwise try to
// statically render it once at build time and serve that stale snapshot
// forever — force per-request execution so the leaderboard is actually live.
export const dynamic = 'force-dynamic'

// GET: PUBLIC, no auth. Uses the service client to read the (RLS-locked)
// criteria_scores table server-side, folds bonus points silently into
// total_score, and returns ONLY safe fields — no per-criterion breakdown,
// no bonus fields or labels, so a participant can never infer bonus exists
// even via devtools/network inspection of this response.
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { pools, updatedAt } = await computeLeaderboard(supabase)

    const publicPools: Record<LeaderboardPool, Record<LeaderboardCategory, LeaderboardEntry[]>> = {
      app_web: { Junior: [], Senior: [] },
      game_dev: { Junior: [], Senior: [] },
    }

    for (const pool of Object.keys(pools) as LeaderboardPool[]) {
      for (const category of Object.keys(pools[pool]) as LeaderboardCategory[]) {
        publicPools[pool][category] = pools[pool][category].map(e => ({
          rank: e.rank,
          team_id: e.team_id,
          team_name: e.team_name,
          project_name: e.project_name,
          track: e.track,
          pool: e.pool,
          category: e.category,
          judge_count: e.judge_count,
          side_quest_points: e.side_quest_points,
          total_score: e.total_score,
        }))
      }
    }

    return NextResponse.json({ pools: publicPools, updatedAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
