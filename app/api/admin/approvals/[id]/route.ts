import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH: OT approves, rejects, or resets a participant's registration.
// The DB trigger prevent_self_approval() is the actual backstop — this
// route just gives OT a clean way to trigger it.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { approval_status } = await request.json()
    if (!['pending', 'approved', 'rejected'].includes(approval_status)) {
      return NextResponse.json({ error: 'approval_status must be pending, approved, or rejected' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('participants')
      .update({ approval_status })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
