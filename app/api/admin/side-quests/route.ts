import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: OT lists all quests, including drafts (for the management UI).
export async function GET() {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('side_quests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: OT creates a new quest, starting in 'draft' status.
export async function POST(request: Request) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { title, description, points } = await request.json()
    if (!title?.trim() || !description?.trim() || typeof points !== 'number' || points <= 0) {
      return NextResponse.json(
        { error: 'title, description, and a positive points value are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('side_quests')
      .insert({ title: title.trim(), description: description.trim(), points, status: 'draft', created_by: user.id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
