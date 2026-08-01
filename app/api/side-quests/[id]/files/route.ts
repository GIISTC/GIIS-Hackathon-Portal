import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestFile } from '@/lib/types'

const BUCKET = 'quest-images'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

// GET: signed download URLs for a quest's attachments. Only granted to
// OT, or to a participant whose team has already picked this exact quest
// — checked here (not just relying on side_quest_details RLS) because
// Storage access itself isn't RLS-protected; the bucket is private and
// every read has to go through this gate.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: judge } = await supabase.from('judges').select('role').eq('id', user.id).single()
  const isOT = judge?.role === 'ot'

  if (!isOT) {
    const { data: participant } = await supabase.from('participants').select('team_id').eq('id', user.id).single()
    if (!participant?.team_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [{ data: pick }, { data: quest }] = await Promise.all([
      supabase.from('side_quest_picks').select('difficulty').eq('team_id', participant.team_id).maybeSingle(),
      supabase.from('side_quests').select('difficulty').eq('id', params.id).maybeSingle(),
    ])
    if (!pick || !quest || pick.difficulty !== quest.difficulty) {
      return NextResponse.json({ error: 'Your team has not picked this tier' }, { status: 403 })
    }
  }

  const { data: details, error } = await supabase
    .from('side_quest_details').select('files').eq('quest_id', params.id).single()
  if (error || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

  const files: QuestFile[] = details.files || []
  if (files.length === 0) return NextResponse.json({ files: [] })

  const service = createServiceClient()

  // Signed individually rather than via createSignedUrls, so each URL can
  // carry its own `download` filename — that sets Content-Disposition so
  // the browser saves "solution.py" instead of the UUID storage key.
  const signed = await Promise.all(
    files.map(async (f) => {
      const { data } = await service.storage
        .from(BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL, { download: f.name })
      return data?.signedUrl ? { path: f.path, name: f.name, size: f.size, type: f.type, url: data.signedUrl } : null
    }),
  )

  return NextResponse.json({ files: signed.filter(Boolean) })
}
