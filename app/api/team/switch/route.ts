import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MAX_TEAM_SIZE } from '@/lib/types'

// POST: a participant switches to a different team by code. Works even if
// they're currently solo. Uses the service-role client so the whole move is
// enforced server-side (including the team_switching_enabled flag, which the
// old client-only implementation never actually checked) rather than relying
// on a participant's own RLS privileges.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { team_code } = await request.json()
    const code = typeof team_code === 'string' ? team_code.trim().toUpperCase() : ''
    if (!code) return NextResponse.json({ error: 'Team code is required.' }, { status: 400 })

    const service = createServiceClient()

    const { data: setting } = await service.from('system_settings').select('value').eq('key', 'team_switching_enabled').maybeSingle()
    if (!(setting?.value === true)) {
      return NextResponse.json({ error: 'Team switching is currently locked by the organizers.' }, { status: 403 })
    }

    const { data: me } = await service.from('participants').select('id, team_id, is_team_leader, approval_status').eq('id', user.id).single()
    if (!me) return NextResponse.json({ error: 'You must be a registered participant to switch teams.' }, { status: 400 })
    if (me.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Your registration is still pending OT approval.' }, { status: 403 })
    }

    const { data: targetTeam } = await service.from('teams').select('*, participants(id)').eq('team_code', code).single()
    if (!targetTeam) return NextResponse.json({ error: 'Invalid team code.' }, { status: 404 })
    if (targetTeam.id === me.team_id) return NextResponse.json({ error: "You're already on this team." }, { status: 400 })
    if (targetTeam.participants.length >= MAX_TEAM_SIZE) {
      return NextResponse.json({ error: `Target team is already full (max ${MAX_TEAM_SIZE} members).` }, { status: 400 })
    }

    const { error: moveError } = await service
      .from('participants')
      .update({ team_id: targetTeam.id, is_team_leader: false })
      .eq('id', user.id)
    if (moveError) throw moveError

    const oldTeamId = me.team_id
    if (oldTeamId) {
      const { data: remaining } = await service.from('participants').select('id, is_team_leader').eq('team_id', oldTeamId)
      if (!remaining || remaining.length === 0) {
        // Cascades clean up submissions/scores/side-quest rows for the old team.
        await service.from('teams').delete().eq('id', oldTeamId)
      } else if (!remaining.some((p) => p.is_team_leader)) {
        await service.from('participants').update({ is_team_leader: true }).eq('id', remaining[0].id)
      }
    }

    return NextResponse.json({ team_id: targetTeam.id, team_name: targetTeam.team_name, team_code: targetTeam.team_code })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
