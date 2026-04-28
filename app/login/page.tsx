'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import styles from './page.module.css'

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
      password: password,
    })

    if (authError) {
      setLoading(false)
      setError('Invalid email or password. Please try again.')
      return
    }

    // Role-based redirect: judges go to /admin, participants go to /dashboard
    const { data: judge } = await supabase
      .from('judges')
      .select('id')
      .eq('id', data.user.id)
      .single()

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
    <>
      <Navbar />
      <div className={styles.wrapper}>
        <div className={`card ${styles.loginCard}`}>
          {/* Logo */}
          <div className={styles.logo}>
            <span className={styles.logoGlyph}>⟨/⟩</span>
            <span className={styles.logoText}>GIIS<span>HACK</span> 2K26</span>
          </div>

          <h2 className={styles.title}>Welcome Back</h2>
          <p className={styles.subtitle}>
            Sign in to access your dashboard.
          </p>

          <form onSubmit={handleLogin} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Signing in...' : '🔑 Sign In'}
            </button>

            {!showForgot && !resetSent && (
              <button
                type="button"
                className="btn btn-ghost btn-full"
                style={{ fontSize: '0.85rem' }}
                onClick={() => setShowForgot(true)}
              >
                Forgot your password?
              </button>
            )}

            {showForgot && !resetSent && (
              <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: 'var(--space-2)' }}>
                  Enter your registered email above and click below to receive a reset link.
                </p>
                <button
                  type="button"
                  className={`btn btn-outline btn-full ${resetLoading ? 'btn-loading' : ''}`}
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : '📧 Send Reset Link'}
                </button>
                <button type="button" className="btn btn-ghost btn-full" style={{ fontSize: '0.8rem', marginTop: 4 }} onClick={() => setShowForgot(false)}>Cancel</button>
              </div>
            )}

            {resetSent && (
              <div className="alert alert-info" style={{ marginTop: 'var(--space-2)' }}>
                <span>📬</span>
                <span>Reset link sent! Check your inbox and follow the link to set a new password.</span>
              </div>
            )}
          </form>

          <div className={styles.dividerLine}>
            <span>or</span>
          </div>

          <p className={styles.registerPrompt}>
            Not registered yet?{' '}
            <Link href="/register">Register your team →</Link>
          </p>
        </div>
      </div>
    </>
  )
}
