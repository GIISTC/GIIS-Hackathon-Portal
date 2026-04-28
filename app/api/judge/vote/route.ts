import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeRatings } from '@/lib/judging/gavel'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify judge
    const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
    if (!judge) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { winner_id, loser_id, skip } = await request.json()

    if (skip) {
      return NextResponse.json({ success: true, skipped: true })
    }

    if (!winner_id || !loser_id) {
      return NextResponse.json({ error: 'Missing winner or loser' }, { status: 400 })
    }

    // 1. Record the matchup (The Source of Truth)
    const { error: matchupError } = await supabase.from('matchups').insert({
      judge_id: judge.id,
      winner_id,
      loser_id
    })

    if (matchupError) throw matchupError

    // 2. OFFICIAL GAVEL LOGIC: Recompute ALL ratings using Bradley-Terry MLE
    // This ensures the leaderboard is always 100% mathematically optimal.
    
    // Fetch all submissions and all matchups
    const { data: allSubmissions } = await supabase.from('submissions').select('id')
    const { data: allMatchups } = await supabase.from('matchups').select('winner_id, loser_id')

    if (allSubmissions && allMatchups) {
      const projectIds = allSubmissions.map(s => s.id)
      const newRatings = computeRatings(projectIds, allMatchups)

      // 3. Update matches_played and ratings for all involved
      const matchCounts: Record<string, number> = {}
      allMatchups.forEach(m => {
        matchCounts[m.winner_id] = (matchCounts[m.winner_id] || 0) + 1
        matchCounts[m.loser_id] = (matchCounts[m.loser_id] || 0) + 1
      })

      // Perform updates in a single batch-like fashion using a multi-row update
      // Since Supabase/Postgrest doesn't support easy multi-row conditional updates,
      // we use an upsert with just the updated fields.
      const updateData = projectIds.map(id => ({
        id,
        elo_rating: newRatings[id],
        matches_played: matchCounts[id] || 0
      }))

      const { error: updateError } = await supabase
        .from('submissions')
        .upsert(updateData, { onConflict: 'id' })

      if (updateError) throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Judging Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
