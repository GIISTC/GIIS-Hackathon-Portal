import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TRACKS = ['App Dev', 'Web Dev', 'Game Dev']

// PATCH: OT edits a team's name and/or track.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const update: Record<string, any> = {}
    if (typeof body.team_name === 'string' && body.team_name.trim()) update.team_name = body.team_name.trim()
    if (body.track !== undefined) {
      if (body.track !== null && !TRACKS.includes(body.track)) {
        return NextResponse.json({ error: 'Invalid track' }, { status: 400 })
      }
      update.track = body.track
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await supabase.from('teams').update(update).eq('id', params.id).select().single()
    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'A team with this name already exists.' }, { status: 400 })
      }
      throw error
    }
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: removes the team entirely. Cascades to participants
// (team_id set null / removed depending on schema), submissions,
// criteria_scores, side_quest_submissions, side_quest_picks.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { error } = await supabase.from('teams').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
