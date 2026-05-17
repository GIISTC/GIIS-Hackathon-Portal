import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl

  // ── Auth code redirect ─────────────────────────────────────────
  // Supabase password-reset emails redirect to the Site URL root
  // with ?code= appended. Forward it to the real callback handler.
  if (pathname === '/' && searchParams.has('code')) {
    const code = searchParams.get('code')!
    const callbackUrl = new URL('/auth/callback', origin)
    callbackUrl.searchParams.set('code', code)
    callbackUrl.searchParams.set('next', '/auth/reset-password')
    return NextResponse.redirect(callbackUrl)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Protect Admin Routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verify judge role
    const { data: judge } = await supabase
      .from('judges')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!judge) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // 2. Protect Dashboard Routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 3. Redirect logged in users away from login/register
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/admin/:path*', '/dashboard/:path*', '/login', '/register'],
}
