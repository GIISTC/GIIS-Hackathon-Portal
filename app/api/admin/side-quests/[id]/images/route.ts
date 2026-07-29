import { requireOT } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BUCKET = 'quest-images'
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_IMAGES = 8

// POST: OT uploads one or more images for a quest (multipart/form-data,
// field name "images"). Uses the service-role client for Storage because
// the bucket is private and only ever touched server-side — participants
// never get direct Storage access, only signed URLs minted after we've
// verified their team picked this exact quest (see
// app/api/side-quests/[id]/images/route.ts).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: details, error: detailsError } = await supabase
      .from('side_quest_details')
      .select('image_paths')
      .eq('quest_id', params.id)
      .single()
    if (detailsError || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

    const existingPaths: string[] = details.image_paths || []

    const formData = await request.formData()
    const files = formData.getAll('images').filter((f): f is File => f instanceof File)
    if (files.length === 0) return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    if (existingPaths.length + files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `A quest can have at most ${MAX_IMAGES} images` }, { status: 400 })
    }

    const service = createServiceClient()
    const newPaths: string[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `${file.name} is not an image` }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name} is larger than 5MB` }, { status: 400 })
      }
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      const path = `${params.id}/${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await service.storage.from(BUCKET).upload(path, buffer, { contentType: file.type })
      if (uploadError) throw uploadError
      newPaths.push(path)
    }

    const image_paths = [...existingPaths, ...newPaths]
    const { data: updated, error: updateError } = await supabase
      .from('side_quest_details')
      .update({ image_paths, updated_at: new Date().toISOString() })
      .eq('quest_id', params.id)
      .select('image_paths')
      .single()
    if (updateError) throw updateError

    return NextResponse.json({ image_paths: updated.image_paths })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT removes a single image (body: { path }).
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
      .select('image_paths')
      .eq('quest_id', params.id)
      .single()
    if (detailsError || !details) return NextResponse.json({ error: 'Quest not found' }, { status: 404 })

    const image_paths = (details.image_paths || []).filter((p: string) => p !== path)

    const { error: updateError } = await supabase
      .from('side_quest_details')
      .update({ image_paths, updated_at: new Date().toISOString() })
      .eq('quest_id', params.id)
    if (updateError) throw updateError

    const service = createServiceClient()
    await service.storage.from(BUCKET).remove([path])

    return NextResponse.json({ image_paths })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
