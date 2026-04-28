'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase automatically handles the token in the URL hash
    // We just need to wait for the session to be established
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    // Also check if session already exists (e.g. from PKCE code exchange in callback)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true)
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 440,
    margin: '80px auto',
    padding: 'var(--space-5)',
  }

  if (success) {
    return (
      <>
        <Navbar />
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="card" style={cardStyle}>
            <div style={{ textAlign: 'center', fontSize: '3rem', marginBottom: 'var(--space-3)' }}>✅</div>
            <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>Password Updated!</h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>
              Your password has been changed successfully. Redirecting to login...
            </p>
          </div>
        </div>
      </>
    )
  }

  if (!sessionReady) {
    return (
      <>
        <Navbar />
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="card" style={cardStyle}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto var(--space-3)' }} />
              <p style={{ color: 'var(--color-text-dim)' }}>Verifying your reset link...</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: 8 }}>
                If this takes too long, your link may have expired.{' '}
                <a href="/login" style={{ color: 'var(--color-accent)' }}>Request a new one</a>.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div style={{ padding: 'var(--space-4)' }}>
        <div className="card" style={cardStyle}>
          <div style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>🔑</div>
          <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Set New Password</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', marginBottom: 'var(--space-4)', fontSize: '0.9rem' }}>
            Choose a strong password for your account.
          </p>

          <form onSubmit={handleReset}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                className="form-control"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                className="form-control"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Updating...' : '✅ Update Password'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
