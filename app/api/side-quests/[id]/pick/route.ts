import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST: a team blind-picks one quest. Irreversible — the UNIQUE(team_id)
// constraint on side_quest_picks is what actually enforces "one choice
// only", so a race between two teammates double-clicking still can't
// produce two picks for the same team.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: participant } = await supabase.from('participants').select('team_id').eq('id', user.id).single()
    if (!participant?.team_id) {
      return NextResponse.json({ error: 'You must be on a team to pick a quest.' }, { status: 400 })
    }

    const { data: existingPick } = await supabase
      .from('side_quest_picks').select('quest_id').eq('team_id', participant.team_id).maybeSingle()
    if (existingPick) {
      return NextResponse.json({ error: 'Your team has already picked a quest — that choice is locked in.' }, { status: 400 })
    }

    const { data: quest } = await supabase.from('side_quests').select('status').eq('id', params.id).single()
    if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
    if (quest.status !== 'open') {
      return NextResponse.json({ error: 'This quest is not currently open for picking.' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('side_quest_picks')
      .insert({ team_id: participant.team_id, quest_id: params.id })
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Your team has already picked a quest — that choice is locked in.' }, { status: 400 })
      }
      throw insertError
    }

    const { data: details } = await supabase
      .from('side_quest_details').select('title, description, files').eq('quest_id', params.id).single()

    return NextResponse.json({
      quest_id: params.id,
      title: details?.title ?? null,
      description: details?.description ?? null,
      files: details?.files ?? [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
