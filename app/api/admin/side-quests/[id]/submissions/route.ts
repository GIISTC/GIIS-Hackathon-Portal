import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: OT views every team's submission for a quest, for grading.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('side_quest_submissions')
    .select('*, team:teams(team_name, track)')
    .eq('quest_id', params.id)
    .order('submitted_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
