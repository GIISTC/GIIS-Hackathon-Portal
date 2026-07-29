import { requireOT, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MAX_TEAM_SIZE } from '@/lib/types'

// Shared cleanup for a team a participant just left: delete it if it's now
// empty, otherwise make sure someone is still marked leader. Used by both
// the participant-move and participant-delete paths below.
async function cleanupOldTeam(supabase: any, oldTeamId: string) {
  const { data: remaining } = await supabase.from('participants').select('id, is_team_leader').eq('team_id', oldTeamId)
  if (!remaining || remaining.length === 0) {
    await supabase.from('teams').delete().eq('id', oldTeamId)
  } else if (!remaining.some((p: any) => p.is_team_leader)) {
    await supabase.from('participants').update({ is_team_leader: true }).eq('id', remaining[0].id)
  }
}

// PATCH: OT edits a participant's profile fields, including moving them to
// a different team outright (team_id). Unlike the participant-facing
// switch-team route, this is never gated by the team_switching_enabled
// setting — that flag only controls self-service switching.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const update: Record<string, any> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) update.full_name = body.full_name.trim()
    if (typeof body.grade === 'string' && body.grade.trim()) update.grade = body.grade.trim()
    if (typeof body.is_team_leader === 'boolean') update.is_team_leader = body.is_team_leader
    if (typeof body.checked_in === 'boolean') {
      update.checked_in = body.checked_in
      update.checked_in_at = body.checked_in ? new Date().toISOString() : null
    }

    let oldTeamId: string | null = null
    if (typeof body.team_id === 'string' && body.team_id) {
      const { data: current } = await supabase.from('participants').select('team_id').eq('id', params.id).single()
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      if (current.team_id !== body.team_id) {
        const { data: targetTeam } = await supabase.from('teams').select('id, participants(id)').eq('id', body.team_id).single()
        if (!targetTeam) return NextResponse.json({ error: 'Target team not found' }, { status: 404 })
        if (targetTeam.participants.length >= MAX_TEAM_SIZE) {
          return NextResponse.json({ error: `Target team is already full (max ${MAX_TEAM_SIZE} members).` }, { status: 400 })
        }
        update.team_id = body.team_id
        update.is_team_leader = false
        oldTeamId = current.team_id
      }
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await supabase.from('participants').update(update).eq('id', params.id).select().single()
    if (error) throw error

    if (oldTeamId) await cleanupOldTeam(supabase, oldTeamId)

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: OT wipes a participant's registration entirely — not just off a
// team, but the whole account, including the underlying Supabase Auth user
// (via the service-role admin API). Without that second step the email
// stays permanently claimed in auth.users and the person could never
// register again with it. If this leaves their team empty, the team is
// deleted too; if it leaves the team without a leader, the first remaining
// member is promoted.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const { data: target } = await supabase.from('participants').select('team_id').eq('id', params.id).single()
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { error: deleteError } = await supabase.from('participants').delete().eq('id', params.id)
    if (deleteError) throw deleteError

    if (target.team_id) await cleanupOldTeam(supabase, target.team_id)

    // Best-effort — the registration is already gone from the app's point
    // of view even if this fails (e.g. the auth user was already removed).
    try {
      await createServiceClient().auth.admin.deleteUser(params.id)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
