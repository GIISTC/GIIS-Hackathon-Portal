import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify judge
    const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
    if (!judge) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all submissions
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*, team:teams(team_name)')

    if (error || !submissions || submissions.length < 2) {
      return NextResponse.json({ error: 'Not enough submissions to judge yet.' }, { status: 400 })
    }

    // Fetch this judge's previous matchups to avoid duplicates
    const { data: previousMatchups } = await supabase
      .from('matchups')
      .select('winner_id, loser_id')
      .eq('judge_id', judge.id)

    const seenPairs = new Set<string>()
    previousMatchups?.forEach(m => {
      seenPairs.add([m.winner_id, m.loser_id].sort().join(':'))
    })

    // OFFICIAL GAVEL PAIRING LOGIC
    // 1. Pick Project A: The one with the absolute fewest matches played
    submissions.sort((a, b) => (a.matches_played || 0) - (b.matches_played || 0))
    
    // Find the pool of projects with the minimum matches
    const minMatches = submissions[0].matches_played || 0
    const poolA = submissions.filter(s => (s.matches_played || 0) === minMatches)
    const projectA = poolA[Math.floor(Math.random() * poolA.length)]

    // 2. Pick Project B: The "Best Match" for A
    // Gavel looks for projects with similar ratings and similar match counts
    let projectB = null
    let bestScore = Infinity

    for (const candidate of submissions) {
      if (candidate.id === projectA.id) continue

      // Avoid projects this judge has already compared for this specific pair
      const pairId = [projectA.id, candidate.id].sort().join(':')
      if (seenPairs.has(pairId)) continue

      // Scoring function for "Match Quality"
      // Goal: Minimize rating difference and match count difference
      const ratingDiff = Math.abs((candidate.elo_rating || 1200) - (projectA.elo_rating || 1200))
      const matchDiff = Math.abs((candidate.matches_played || 0) - (projectA.matches_played || 0))
      
      // Gavel uses a weighted score. Similar ratings are very important for accuracy.
      // Small random noise is added to prevent deterministic loops.
      const score = (ratingDiff * 1.0) + (matchDiff * 5.0) + (Math.random() * 5.0)

      if (score < bestScore) {
        bestScore = score
        projectB = candidate
      }
    }

    // Fallback: If all candidates have been seen by this judge, just pick a random one
    if (!projectB) {
      const remaining = submissions.filter(s => s.id !== projectA.id)
      projectB = remaining[Math.floor(Math.random() * remaining.length)]
    }

    // Shuffle A and B
    const response = Math.random() > 0.5 
      ? { projectA: projectB, projectB: projectA } 
      : { projectA, projectB }

    return NextResponse.json(response)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
