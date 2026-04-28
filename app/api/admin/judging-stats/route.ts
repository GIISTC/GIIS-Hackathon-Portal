import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Fetch submissions
    const { data: submissions } = await supabase.from('submissions').select('id, matches_played')
    
    // Fetch total matchups
    const { count: totalVotes, error } = await supabase
      .from('matchups')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        totalVotes: 0,
        projectCount: 0,
        avgMatches: 0,
        progress: 0,
        status: 'No Submissions'
      })
    }

    const projectCount = submissions.length
    // Each vote involves 2 projects, so total "match instances" is totalVotes * 2
    const totalMatchInstances = (totalVotes || 0) * 2
    const avgMatches = totalMatchInstances / projectCount
    
    // Progress calculation based on Gavel's recommended 10 matches per project
    const progress = Math.min((avgMatches / 10) * 100, 100)

    let status = 'Collecting Votes'
    if (avgMatches >= 10) status = 'High Confidence'
    else if (avgMatches >= 7) status = 'Medium Confidence'
    else if (avgMatches >= 4) status = 'Early Trends'

    return NextResponse.json({
      totalVotes,
      projectCount,
      avgMatches: avgMatches.toFixed(1),
      progress: Math.round(progress),
      status,
      isReady: avgMatches >= 9
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
