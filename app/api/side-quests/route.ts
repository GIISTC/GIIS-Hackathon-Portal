import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: participant-facing quest list — open + closed quests (never drafts),
// each annotated with the caller's own team's submission (if any), so the
// dashboard can render verdicts without a second round trip.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: participant } = await supabase
    .from('participants')
    .select('team_id')
    .eq('id', user.id)
    .single()

  const { data: quests, error } = await supabase
    .from('side_quests')
    .select('*')
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let submissions: any[] = []
  if (participant?.team_id) {
    const { data: subs } = await supabase
      .from('side_quest_submissions')
      .select('*')
      .eq('team_id', participant.team_id)
    submissions = subs || []
  }

  const questsWithSubmission = (quests || []).map(q => ({
    ...q,
    mySubmission: submissions.find(s => s.quest_id === q.id) || null,
  }))

  return NextResponse.json(questsWithSubmission)
}
