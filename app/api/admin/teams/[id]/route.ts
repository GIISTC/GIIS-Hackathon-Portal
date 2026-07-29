import { requireOT, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TRACKS } from '@/lib/types'

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
      const track = body.track || null // "" (from the "No Track" option) means Junior-style null
      if (track !== null && !TRACKS.includes(track)) {
        return NextResponse.json({ error: 'Invalid track' }, { status: 400 })
      }
      update.track = track
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

// DELETE: removes the team entirely, plus every member's registration —
// including their Supabase Auth accounts (so their emails are free to
// register again), not just the participant rows. Submissions,
// criteria_scores, side_quest_submissions, and side_quest_picks cascade
// from the team row itself.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data: members } = await supabase.from('participants').select('id').eq('team_id', params.id)

  const { error } = await supabase.from('teams').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const service = createServiceClient()
  await Promise.all((members || []).map((m) => service.auth.admin.deleteUser(m.id).catch(() => {})))

  return NextResponse.json({ success: true })
}
