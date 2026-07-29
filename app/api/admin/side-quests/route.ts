import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestDifficulty } from '@/lib/types'

const DIFFICULTIES: QuestDifficulty[] = ['beginner', 'intermediate', 'advanced']

// GET: OT lists all quests, including drafts (for the management UI).
// OT always sees full content — the RLS split only hides content from
// participants who haven't picked a given quest yet.
export async function GET() {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('side_quests')
    .select('*, details:side_quest_details(title, description, image_paths)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const quests = (data || []).map((q: any) => ({
    id: q.id, difficulty: q.difficulty, points: q.points, status: q.status,
    created_by: q.created_by, created_at: q.created_at, opened_at: q.opened_at, closed_at: q.closed_at,
    title: q.details?.title ?? null,
    description: q.details?.description ?? null,
    image_paths: q.details?.image_paths ?? [],
  }))

  return NextResponse.json(quests)
}

// POST: OT creates a new quest, starting in 'draft' status. Title and
// description are stored in side_quest_details, which is RLS-locked to
// OT + the team that eventually picks this quest — that's what makes
// the blind choice actually blind, not just a UI trick.
export async function POST(request: Request) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { title, description, points, difficulty } = await request.json()
    if (!title?.trim() || !description?.trim() || typeof points !== 'number' || points <= 0) {
      return NextResponse.json(
        { error: 'title, description, and a positive points value are required' },
        { status: 400 }
      )
    }
    if (!DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: 'difficulty must be beginner, intermediate, or advanced' }, { status: 400 })
    }

    const { data: quest, error: questError } = await supabase
      .from('side_quests')
      .insert({ points, difficulty, status: 'draft', created_by: user.id })
      .select()
      .single()
    if (questError) throw questError

    const { data: details, error: detailsError } = await supabase
      .from('side_quest_details')
      .insert({ quest_id: quest.id, title: title.trim(), description: description.trim() })
      .select()
      .single()
    if (detailsError) throw detailsError

    return NextResponse.json({ ...quest, title: details.title, description: details.description, image_paths: details.image_paths })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
