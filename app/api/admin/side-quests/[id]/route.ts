import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: OT edits a quest's fields and/or transitions its status.
// Allowed status flow: draft -> open -> closed. Closed quests are locked —
// no further edits, no reopening (create a new quest instead).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: current } = await supabase.from('side_quests').select('status').eq('id', params.id).single()
    if (!current) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
    if (current.status === 'closed') {
      return NextResponse.json({ error: 'Closed quests are locked. Create a new quest instead.' }, { status: 400 })
    }

    const body = await request.json()
    const update: Record<string, any> = {}

    if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
    if (typeof body.description === 'string' && body.description.trim()) update.description = body.description.trim()
    if (typeof body.points === 'number' && body.points > 0) update.points = body.points

    if (body.status) {
      if (!['draft', 'open', 'closed'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      update.status = body.status
      if (body.status === 'open') update.opened_at = new Date().toISOString()
      if (body.status === 'closed') update.closed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('side_quests')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: only allowed while still a draft (never delete a quest with submissions).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data: quest } = await supabase.from('side_quests').select('status').eq('id', params.id).single()
  if (!quest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quest.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft quests can be deleted' }, { status: 400 })
  }

  const { error } = await supabase.from('side_quests').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
