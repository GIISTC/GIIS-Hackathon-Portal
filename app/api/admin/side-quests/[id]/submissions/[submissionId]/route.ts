import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: OT marks a team's submission Correct or Incorrect. Correct awards
// the quest's full point value (handled by the leaderboard computation
// summing side_quest_submissions where verdict = 'correct'); Incorrect
// awards nothing. No partial credit.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; submissionId: string } }
) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { verdict } = await request.json()
    if (!['correct', 'incorrect'].includes(verdict)) {
      return NextResponse.json({ error: 'verdict must be "correct" or "incorrect"' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('side_quest_submissions')
      .update({ verdict, graded_by: user.id, graded_at: new Date().toISOString() })
      .eq('id', params.submissionId)
      .eq('quest_id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
