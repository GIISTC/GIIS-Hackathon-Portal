import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BUCKET = 'quest-images'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

// GET: signed URLs for a quest's images. Only granted to OT, or to a
// participant whose team has already picked this exact quest — checked
// here (not just relying on side_quest_details RLS) because Storage
// access itself isn't RLS-protected; the bucket is private and every
// read has to go through this gate.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: judge } = await supabase.from('judges').select('role').eq('id', user.id).single()
  const isOT = judge?.role === 'ot'

  if (!isOT) {
    const { data: participant } = await supabase.from('participants').select('team_id').eq('id', user.id).single()
    if (!participant?.team_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: pick } = await supabase
      .from('side_quest_picks').select('quest_id').eq('team_id', participant.team_id).maybeSingle()
    if (!pick || pick.quest_id !== params.id) {
      return NextResponse.json({ error: 'Your team has not picked this quest' }, { status: 403 })
    }
  }

  const { data: details, error } = await supabase
    .from('side_quest_details').select('image_paths').eq('quest_id', params.id).single()
  if (error || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

  const paths: string[] = details.image_paths || []
  if (paths.length === 0) return NextResponse.json({ urls: [] })

  const service = createServiceClient()
  const { data: signed, error: signError } = await service.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 })

  return NextResponse.json({ urls: (signed || []).map((s) => s.signedUrl).filter(Boolean) })
}
