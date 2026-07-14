import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeLeaderboard } from '@/lib/leaderboard'

// GET: OT-only. Returns the full breakdown (every criterion + bonus average,
// criteria_total, bonus_total) for the internal judging leaderboard. Never
// called from participant-facing code.
export async function GET() {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const result = await computeLeaderboard(supabase)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
