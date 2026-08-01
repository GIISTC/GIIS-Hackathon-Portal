import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestDifficulty } from '@/lib/types'

const TIERS: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

// POST: a team blind-picks a difficulty TIER and unlocks every quest in
// it. Irreversible — the UNIQUE(team_id) constraint on side_quest_picks
// is what actually enforces "one choice only", so two teammates racing
// each other still can't produce two picks for the same team.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const difficulty = String(body?.difficulty || '') as QuestDifficulty
    if (!TIERS.includes(difficulty)) {
      return NextResponse.json({ error: 'Pick one of the three difficulty tiers.' }, { status: 400 })
    }

    const { data: participant } = await supabase
      .from('participants').select('team_id').eq('id', user.id).single()
    if (!participant?.team_id) {
      return NextResponse.json({ error: 'You must be on a team to pick a quest.' }, { status: 400 })
    }

    const { data: existingPick } = await supabase
      .from('side_quest_picks').select('difficulty').eq('team_id', participant.team_id).maybeSingle()
    if (existingPick) {
      return NextResponse.json(
        { error: 'Your team has already picked a tier — that choice is locked in.' },
        { status: 400 },
      )
    }

    const { count } = await supabase
      .from('side_quests')
      .select('id', { count: 'exact', head: true })
      .eq('difficulty', difficulty)
      .eq('status', 'open')
    if (!count) {
      return NextResponse.json({ error: 'That tier has no open quests right now.' }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('side_quest_picks')
      .insert({ team_id: participant.team_id, difficulty })
    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Your team has already picked a tier — that choice is locked in.' },
          { status: 400 },
        )
      }
      throw insertError
    }

    return NextResponse.json({ difficulty, quest_count: count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
