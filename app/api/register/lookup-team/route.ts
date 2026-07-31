import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { MAX_TEAM_SIZE } from '@/lib/types'

// Team-code lookup for the registration page.
//
// This runs server-side with the service-role client on purpose. The person
// joining a team has no session yet (or a brand new one with no participant
// row), so any client-side query here is at the mercy of RLS on both `teams`
// and the embedded `participants` — and a policy change anywhere else in the
// app would silently turn every join into "invalid team code". Going through
// the service role makes the lookup independent of policy drift.
//
// It also fixes a real counting bug: read as an anonymous user, the embedded
// participants list came back empty because of the participants SELECT
// policy, so the "team is full" check never fired and a team could take on
// more than MAX_TEAM_SIZE members.

// Codes are 6 chars of base36, uppercased at generation. Normalise the same
// way here so a pasted code with spaces, lowercase, or stray punctuation
// still resolves.
const normalizeCode = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = normalizeCode(String(body?.code ?? ''))
    if (!code) return NextResponse.json({ error: 'Enter a team code.' }, { status: 400 })

    const service = createServiceClient()

    const { data: team, error } = await service
      .from('teams')
      .select('id, team_name, track, participants(id)')
      .eq('team_code', code)
      .maybeSingle()

    if (error) {
      // Surface the real database error rather than pretending the code is
      // wrong — a schema/policy problem looked identical to a typo before.
      console.error('Team lookup failed:', error, 'code:', code)
      return NextResponse.json(
        { error: `Could not look up that code: ${error.message}` },
        { status: 500 },
      )
    }

    if (!team) {
      return NextResponse.json(
        { error: `No team found with the code ${code}. Check it with your team leader.` },
        { status: 404 },
      )
    }

    const memberCount = (team.participants || []).length
    return NextResponse.json({
      id: team.id,
      team_name: team.team_name,
      track: team.track ?? null,
      member_count: memberCount,
      is_full: memberCount >= MAX_TEAM_SIZE,
      max_size: MAX_TEAM_SIZE,
    })
  } catch (err: any) {
    console.error('Team lookup crashed:', err)
    return NextResponse.json({ error: err?.message || 'Team lookup failed.' }, { status: 500 })
  }
}
