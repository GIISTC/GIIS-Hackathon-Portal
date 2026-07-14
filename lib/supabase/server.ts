import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Next.js patches global fetch and caches GET responses by default — including
// the fetches Supabase makes internally. That serves stale DB reads (e.g. a
// leaderboard that never updates after a score is saved). Force every query
// through the network so server-side reads are always live.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: noStoreFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookie setting is best-effort
          }
        },
      },
    }
  )
}

// Service role client — bypasses RLS. Only use in server-side API routes
// where you have already verified the user's identity/permissions in application code.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } }
  )
}

// Shared auth check for OT-only API routes. Returns the cookie-bound client
// plus the caller's user/judge rows (both null if not logged in). Callers
// must still branch on `user`/`judge.role` themselves to return the right
// 401/403 — this only centralizes the two lookups, not the response shape.
export async function requireOT() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, judge: null }
  const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
  return { supabase, user, judge }
}
