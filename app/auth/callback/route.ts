import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If this is a password reset flow, go straight to the reset page
      if (next === '/auth/reset-password') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }

      // Otherwise role-based redirect: judge → /admin, participant → /dashboard
      const { data: { user } } = await supabase.auth.getUser()
      const { data: judge } = await supabase
        .from('judges').select('id').eq('id', user?.id).single()

      return NextResponse.redirect(`${origin}${judge ? '/admin' : next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
