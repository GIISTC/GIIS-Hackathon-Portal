import { requireOT } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CRITERIA_MAX, BONUS_MAX } from '@/lib/types'

const FIELD_MAX = { ...CRITERIA_MAX, ...BONUS_MAX }

export async function POST(request: Request) {
  const { supabase, user, judge } = await requireOT()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!judge || judge.role !== 'ot') {
    return NextResponse.json({ error: 'Forbidden — OT access only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { team_id, notes, ...fields } = body

    if (!team_id) return NextResponse.json({ error: 'Missing team_id' }, { status: 400 })

    for (const key of Object.keys(FIELD_MAX) as (keyof typeof FIELD_MAX)[]) {
      const value = fields[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > FIELD_MAX[key]) {
        return NextResponse.json({ error: `Invalid value for ${key} — must be 0-${FIELD_MAX[key]}` }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('criteria_scores')
      .upsert(
        {
          team_id,
          judge_id: user.id,
          relevance: fields.relevance,
          creativity: fields.creativity,
          functionality: fields.functionality,
          ux: fields.ux,
          presentation: fields.presentation,
          code_quality: fields.code_quality,
          completeness: fields.completeness,
          bonus_mvp: fields.bonus_mvp,
          bonus_api: fields.bonus_api,
          bonus_database: fields.bonus_database,
          bonus_auth: fields.bonus_auth,
          bonus_original_assets: fields.bonus_original_assets,
          notes: typeof notes === 'string' ? notes.trim() || null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id,judge_id' }
      )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
