import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: OT edits a participant's profile fields.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const update: Record<string, any> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) update.full_name = body.full_name.trim()
    if (typeof body.grade === 'string' && body.grade.trim()) update.grade = body.grade.trim()
    if (typeof body.is_team_leader === 'boolean') update.is_team_leader = body.is_team_leader
    if (typeof body.checked_in === 'boolean') {
      update.checked_in = body.checked_in
      update.checked_in_at = body.checked_in ? new Date().toISOString() : null
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await supabase.from('participants').update(update).eq('id', params.id).select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT removes a participant outright (kicks them off the event, not
// just off a team). If this leaves their team empty, the team is deleted
// too (same cascade rule as a participant switching teams themselves); if
// it leaves the team without a leader, the first remaining member is
// promoted.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: target } = await supabase.from('participants').select('team_id').eq('id', params.id).single()
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error: deleteError } = await supabase.from('participants').delete().eq('id', params.id)
    if (deleteError) throw deleteError

    if (target.team_id) {
      const { data: remaining } = await supabase.from('participants').select('id, is_team_leader').eq('team_id', target.team_id)
      if (!remaining || remaining.length === 0) {
        await supabase.from('teams').delete().eq('id', target.team_id)
      } else if (!remaining.some((p) => p.is_team_leader)) {
        await supabase.from('participants').update({ is_team_leader: true }).eq('id', remaining[0].id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
