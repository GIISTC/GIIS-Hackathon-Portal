import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: OT edits any field of a submission (not just for re-scoring —
// full content edits, e.g. fixing a broken link on a team's behalf).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const update: Record<string, any> = {}
    if (typeof body.project_name === 'string' && body.project_name.trim()) update.project_name = body.project_name.trim()
    if (typeof body.description === 'string' && body.description.trim()) update.description = body.description.trim()
    if (typeof body.github_url === 'string' && body.github_url.trim()) update.github_url = body.github_url.trim()
    if (body.drive_url !== undefined) update.drive_url = typeof body.drive_url === 'string' ? body.drive_url.trim() || null : null
    if (body.demo_url !== undefined) update.demo_url = typeof body.demo_url === 'string' ? body.demo_url.trim() || null : null
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from('submissions').update(update).eq('id', params.id).select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT removes a submission entirely.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { error } = await supabase.from('submissions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
