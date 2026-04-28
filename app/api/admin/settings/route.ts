import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: Fetch all settings (public — anyone can read)
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('system_settings').select('*')
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Convert [{key, value}] array → { key: value } object
  const settings = (data ?? []).reduce((acc: any, row: any) => {
    acc[row.key] = row.value
    return acc
  }, {})

  return NextResponse.json(settings)
}

// POST: Update a setting (judges/admins only)
export async function POST(request: Request) {
  try {
    // 1. Verify the caller is a logged-in judge using their session cookie
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: judge } = await authClient
      .from('judges').select('id').eq('id', user.id).single()
    if (!judge) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 2. Parse the body
    const { key, value } = await request.json()
    if (!key || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Missing or invalid key/value' }, { status: 400 })
    }

    // 3. Write with service role (bypasses RLS — safe because we verified above)
    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) {
      console.error('[Settings API] Write error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, key, value })
  } catch (err: any) {
    console.error('[Settings API] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
