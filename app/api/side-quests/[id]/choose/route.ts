import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST: stage 2 of picking. The team has already blind-picked a tier;
// this commits them to ONE quest inside it. Permanent — the RLS UPDATE
// policy only applies while quest_id is still null, and a trigger blocks
// swapping it afterwards, so a race between teammates can't produce two
// different choices.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: participant } = await supabase
      .from('participants').select('team_id, approval_status').eq('id', user.id).single()
    if (!participant?.team_id) {
      return NextResponse.json({ error: 'You must be on a team to choose a quest.' }, { status: 400 })
    }
    if (participant.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Your registration is still awaiting OT approval.' },
        { status: 403 },
      )
    }

    const { data: pick } = await supabase
      .from('side_quest_picks').select('difficulty, quest_id').eq('team_id', participant.team_id).maybeSingle()
    if (!pick) {
      return NextResponse.json({ error: 'Your team has not picked a difficulty tier yet.' }, { status: 400 })
    }
    if (pick.quest_id) {
      return NextResponse.json(
        { error: 'Your team has already chosen its quest — that choice is final.' },
        { status: 400 },
      )
    }

    const { data: quest } = await supabase
      .from('side_quests').select('difficulty, status').eq('id', params.id).maybeSingle()
    if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
    if (quest.difficulty !== pick.difficulty) {
      return NextResponse.json({ error: 'That quest is not in your team\'s tier.' }, { status: 403 })
    }
    if (quest.status !== 'open') {
      return NextResponse.json({ error: 'That quest is not open.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('side_quest_picks')
      .update({ quest_id: params.id })
      .eq('team_id', participant.team_id)
      .is('quest_id', null)
    if (updateError) {
      if (updateError.code === '42501' || /row-level security/i.test(updateError.message || '')) {
        return NextResponse.json(
          { error: 'Your team is not allowed to choose that quest right now.' },
          { status: 403 },
        )
      }
      throw updateError
    }

    return NextResponse.json({ quest_id: params.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
