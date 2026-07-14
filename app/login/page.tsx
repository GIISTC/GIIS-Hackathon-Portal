'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

const inputCls =
  'w-full rounded-lg border border-line bg-panel/60 px-4 py-3 font-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand focus:bg-panel'
const labelCls = 'mb-1.5 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setLoading(false)
      setError('Invalid email or password. Please try again.')
      return
    }

    const { data: judge } = await supabase.from('judges').select('id').eq('id', data.user.id).single()
    router.push(judge ? '/admin' : '/dashboard')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email address above first.'); return }
    setResetLoading(true)
    setError(null)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })
    setResetLoading(false)
    setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(70% 50% at 50% 0%, rgba(47,230,200,0.08), transparent 60%)' }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-28">
        <div className="w-full max-w-md rounded-2xl border border-line bg-panel/70 p-8 shadow-panel backdrop-blur">
          <div className="mb-6 flex items-center gap-2.5">
            <img src="/logo.png" alt="GIIS Hackathon" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="font-display text-sm font-bold tracking-wide">GIIS Hackathon <span className="text-brand">2K26</span></span>
          </div>

          <h1 className="font-display text-2xl font-bold text-ink">Welcome Back</h1>
          <p className="mt-1 text-sm text-ink-sub">Sign in to access your dashboard.</p>

          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <div>
              <label className={labelCls} htmlFor="email">Email Address</label>
              <input id="email" type="email" className={inputCls} placeholder="your@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className={labelCls} htmlFor="password">Password</label>
              <input id="password" type="password" className={inputCls} placeholder="Your password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-[#fca5a5]">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            {!showForgot && !resetSent && (
              <button type="button" onClick={() => setShowForgot(true)}
                className="text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-brand">
                Forgot your password?
              </button>
            )}

            {showForgot && !resetSent && (
              <div className="rounded-lg border border-line bg-base/50 p-4">
                <p className="mb-2 text-sm text-ink-sub">Enter your registered email above, then request a reset link.</p>
                <button type="button" onClick={handleForgotPassword} disabled={resetLoading}
                  className="w-full rounded-lg border border-line py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5 disabled:opacity-50">
                  {resetLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => setShowForgot(false)}
                  className="mt-1.5 w-full py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-dim hover:text-ink">
                  Cancel
                </button>
              </div>
            )}

            {resetSent && (
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2.5 text-sm text-brand">
                Reset link sent — check your inbox and follow the link to set a new password.
              </div>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink-dim">
            <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
          </div>

          <p className="text-center text-sm text-ink-sub">
            Not registered yet?{' '}
            <Link href="/register" className="text-brand hover:underline">Register your team →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
