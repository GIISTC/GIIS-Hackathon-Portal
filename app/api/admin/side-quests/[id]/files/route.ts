import { requireOT } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { QuestFile } from '@/lib/types'

const BUCKET = 'quest-images'
const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25MB — matches the bucket limit
const MAX_FILES = 20

// Storage keys can't carry arbitrary characters, so the key is a UUID
// and the real filename is kept in the DB alongside it. That also means
// two files with the same name never collide.
const safeExt = (name: string) => {
  const ext = name.includes('.') ? name.split('.').pop()! : ''
  const cleaned = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
  return cleaned ? `.${cleaned}` : ''
}

// POST: OT uploads one or more files of ANY type for a quest
// (multipart/form-data, field name "files"). The bucket is private and
// only ever touched server-side — participants never get direct Storage
// access, only signed URLs minted after we've verified their team picked
// this exact quest (see app/api/side-quests/[id]/files/route.ts).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: details, error: detailsError } = await supabase
      .from('side_quest_details')
      .select('files')
      .eq('quest_id', params.id)
      .single()
    if (detailsError || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

    const existing: QuestFile[] = details.files || []

    const formData = await request.formData()
    const uploads = formData.getAll('files').filter((f): f is File => f instanceof File)
    if (uploads.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    if (existing.length + uploads.length > MAX_FILES) {
      return NextResponse.json({ error: `A quest can have at most ${MAX_FILES} files` }, { status: 400 })
    }

    const service = createServiceClient()
    const added: QuestFile[] = []

    for (const file of uploads) {
      // Deliberately no file-type restriction — images, .py, .json,
      // .zip, anything. Only size is capped.
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name} is larger than 25MB` }, { status: 400 })
      }
      const path = `${params.id}/${crypto.randomUUID()}${safeExt(file.name)}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await service.storage.from(BUCKET).upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
      })
      if (uploadError) throw uploadError
      added.push({ path, name: file.name, size: file.size, type: file.type || undefined })
    }

    const files = [...existing, ...added]
    const { data: updated, error: updateError } = await supabase
      .from('side_quest_details')
      .update({ files, updated_at: new Date().toISOString() })
      .eq('quest_id', params.id)
      .select('files')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ files: updated.files })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT removes a single file (body: { path }).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { path } = await request.json()
    if (typeof path !== 'string' || !path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

    const { data: details, error: detailsError } = await supabase
      .from('side_quest_details')
      .select('files')
      .eq('quest_id', params.id)
      .single()
    if (detailsError || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

    const files = (details.files || []).filter((f: QuestFile) => f.path !== path)

    const { error: updateError } = await supabase
      .from('side_quest_details')
      .update({ files, updated_at: new Date().toISOString() })
      .eq('quest_id', params.id)
    if (updateError) throw updateError

    const service = createServiceClient()
    await service.storage.from(BUCKET).remove([path])

    return NextResponse.json({ files })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
