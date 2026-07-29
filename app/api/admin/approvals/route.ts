import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: OT lists every participant (all approval states) with their team,
// so the admin UI can filter Pending / Approved / Rejected / All client-side.
export async function GET() {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('participants')
    .select('*, team:teams(team_name, team_code)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
