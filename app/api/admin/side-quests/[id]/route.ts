import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestDifficulty } from '@/lib/types'

const DIFFICULTIES: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

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
    const questUpdate: Record<string, any> = {}
    const detailsUpdate: Record<string, any> = {}

    if (typeof body.points === 'number' && body.points > 0) questUpdate.points = body.points
    if (body.difficulty) {
      if (!DIFFICULTIES.includes(body.difficulty)) {
        return NextResponse.json({ error: 'difficulty must be beginner, intermediate, or advanced' }, { status: 400 })
      }
      questUpdate.difficulty = body.difficulty
    }
    if (typeof body.title === 'string' && body.title.trim()) detailsUpdate.title = body.title.trim()
    if (typeof body.description === 'string' && body.description.trim()) detailsUpdate.description = body.description.trim()

    if (body.status) {
      if (!['draft', 'open', 'closed'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      questUpdate.status = body.status
      if (body.status === 'open') questUpdate.opened_at = new Date().toISOString()
      if (body.status === 'closed') questUpdate.closed_at = new Date().toISOString()
    }

    let quest = current
    if (Object.keys(questUpdate).length > 0) {
      const { data, error } = await supabase.from('side_quests').update(questUpdate).eq('id', params.id).select().single()
      if (error) throw error
      quest = data
    }

    let details: any = null
    if (Object.keys(detailsUpdate).length > 0) {
      detailsUpdate.updated_at = new Date().toISOString()
      const { data, error } = await supabase.from('side_quest_details').update(detailsUpdate).eq('quest_id', params.id).select().single()
      if (error) throw error
      details = data
    } else {
      const { data } = await supabase.from('side_quest_details').select('title, description, image_paths').eq('quest_id', params.id).single()
      details = data
    }

    return NextResponse.json({ ...quest, title: details?.title ?? null, description: details?.description ?? null, image_paths: details?.image_paths ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: only allowed while still a draft (never delete a quest with submissions).
// side_quest_details cascades automatically (ON DELETE CASCADE); any uploaded
// images are left in Storage (harmless — never linked or served to anyone once
// the quest row is gone).
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
