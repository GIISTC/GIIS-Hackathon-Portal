import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: participant-facing quest list. Every open/closed quest is listed so
// the team can see the difficulty tiers on offer, but title/description/
// files only come through for quests in the tier the team picked —
// side_quest_details RLS blocks the embed for every other tier, so this
// isn't app-layer hiding, the database itself won't return the content.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: participant } = await supabase
    .from('participants')
    .select('team_id')
    .eq('id', user.id)
    .single()

  const { data: quests, error } = await supabase
    .from('side_quests')
    .select('id, difficulty, points, status, created_at, opened_at, closed_at, details:side_quest_details(title, description, files)')
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let myPick: { difficulty: string; picked_at: string } | null = null
  let submissions: any[] = []
  if (participant?.team_id) {
    const [{ data: pick }, { data: subs }] = await Promise.all([
      supabase.from('side_quest_picks').select('difficulty, picked_at').eq('team_id', participant.team_id).maybeSingle(),
      supabase.from('side_quest_submissions').select('*').eq('team_id', participant.team_id),
    ])
    myPick = pick || null
    submissions = subs || []
  }

  const questsOut = (quests || []).map((q: any) => ({
    id: q.id,
    difficulty: q.difficulty,
    points: q.points,
    status: q.status,
    created_at: q.created_at,
    opened_at: q.opened_at,
    closed_at: q.closed_at,
    title: q.details?.title ?? null,
    description: q.details?.description ?? null,
    files: q.details?.files ?? [],
    hasFiles: (q.details?.files?.length ?? 0) > 0,
    mySubmission: submissions.find((s) => s.quest_id === q.id) || null,
  }))

  return NextResponse.json({ quests: questsOut, myPick })
}
