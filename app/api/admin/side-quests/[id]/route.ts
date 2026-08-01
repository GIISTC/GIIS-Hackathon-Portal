import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestDifficulty } from '@/lib/types'

const DIFFICULTIES: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

// PATCH: OT edits a quest's fields and/or transitions its status. OT has
// full control — no locked statuses — so a mistake (wrong difficulty, a
// typo after release, an accidental close) can always be corrected.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: current } = await supabase.from('side_quests').select('status, opened_at').eq('id', params.id).single()
    if (!current) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

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
      if (body.status === 'open') {
        // Reopening keeps the original release time and drops the stale
        // closed_at, so an open quest never looks closed in the record.
        if (!current.opened_at) questUpdate.opened_at = new Date().toISOString()
        questUpdate.closed_at = null
      }
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
      const { data } = await supabase.from('side_quest_details').select('title, description, files').eq('quest_id', params.id).single()
      details = data
    }

    return NextResponse.json({ ...quest, title: details?.title ?? null, description: details?.description ?? null, files: details?.files ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT can delete a quest in any status, including ones with live
// picks/submissions — side_quest_details, side_quest_submissions, and
// side_quest_picks all cascade (ON DELETE CASCADE). Any uploaded images are
// left in Storage (harmless — never linked or served to anyone once the
// quest row is gone). This is destructive for teams that already picked it,
// so the confirm dialog lives in the admin UI, not here.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data: quest } = await supabase.from('side_quests').select('status').eq('id', params.id).single()
  if (!quest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('side_quests').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
