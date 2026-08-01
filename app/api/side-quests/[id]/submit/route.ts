import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST: a team submits or edits their response while the quest is open.
// Only response_text/response_link are ever read from the body — verdict
// can never be set here, so a tampered request can't self-grade.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: participant } = await supabase
      .from('participants')
      .select('team_id')
      .eq('id', user.id)
      .single()

    if (!participant?.team_id) {
      return NextResponse.json({ error: 'You must be on a team to submit.' }, { status: 400 })
    }

    const { data: quest } = await supabase.from('side_quests').select('status, difficulty').eq('id', params.id).single()
    if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
    if (quest.status !== 'open') {
      return NextResponse.json({ error: 'This side quest is not currently accepting submissions.' }, { status: 400 })
    }

    // RLS enforces this too — checking here just turns a bare policy
    // denial into a message that explains what happened.
    const { data: pick } = await supabase
      .from('side_quest_picks').select('difficulty, quest_id').eq('team_id', participant.team_id).maybeSingle()
    if (!pick) {
      return NextResponse.json({ error: 'Your team has not picked a difficulty tier yet.' }, { status: 400 })
    }
    if (!pick.quest_id) {
      return NextResponse.json({ error: 'Choose which quest your team is attempting first.' }, { status: 400 })
    }
    if (pick.quest_id !== params.id) {
      return NextResponse.json({ error: 'That is not the quest your team chose.' }, { status: 403 })
    }

    const body = await request.json()
    const response_text = typeof body.response_text === 'string' ? body.response_text.trim() : ''
    const response_link = typeof body.response_link === 'string' ? body.response_link.trim() || null : null

    if (!response_text) {
      return NextResponse.json({ error: 'A response is required.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('side_quest_submissions')
      .upsert(
        {
          quest_id: params.id,
          team_id: participant.team_id,
          submitted_by: user.id,
          response_text,
          response_link,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'quest_id,team_id' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
