'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#schedule', label: 'Schedule' },
  { href: '/#tracks', label: 'Tracks' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/leaderboard', label: 'Leaderboard' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUser(user)
        const { data: judge } = await supabase.from('judges').select('id').eq('id', user.id).maybeSingle()
        if (judge) setIsAdmin(true)
      } catch { /* background check — ignore */ }
    }
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const linkCls = 'font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-sub transition-colors hover:text-brand'
  const btnGhost = 'cursor-pointer border-0 bg-transparent font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-sub transition-colors hover:text-ink'
  const btnOutline = 'rounded-lg border border-line bg-transparent px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5'
  const btnPrimary = 'rounded-lg border-0 bg-gradient-to-br from-brand to-brand-blue px-4 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90'

  return (
    <nav className="fixed inset-x-0 top-3 z-50 mx-auto w-[min(96%,1200px)] font-body">
      <div
        className={`flex items-center justify-between rounded-full border border-line px-5 py-2.5 backdrop-blur-xl transition-colors ${
          scrolled ? 'bg-base/90 shadow-[0_8px_40px_rgba(0,0,0,0.5)]' : 'bg-base/70'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="GIIS Hackathon" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
          <span className="font-display text-sm font-bold tracking-wide text-ink">
            GIIS Hackathon <span className="text-brand">2K26</span>
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={linkCls}>{label}</Link>
            </li>
          ))}
        </ul>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              {isAdmin && <Link href="/admin" className={btnOutline}>Admin</Link>}
              <Link href="/dashboard" className={btnOutline}>Dashboard</Link>
              <button onClick={handleSignOut} className={btnGhost}>Sign Out</button>
            </>
          ) : (
            <>
              <Link href="/login" className={btnGhost}>Login</Link>
              <Link href="/register" className={btnPrimary}>Register</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-ink lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="text-xl leading-none">{menuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mt-2 flex flex-col gap-1 rounded-2xl border border-line bg-base/95 p-3 backdrop-blur-xl lg:hidden">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ink-sub transition-colors hover:bg-panel hover:text-brand"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
            {user ? (
              <>
                {isAdmin && <Link href="/admin" className={`${btnOutline} text-center`} onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
                <Link href="/dashboard" className={`${btnOutline} text-center`} onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleSignOut} className={`${btnGhost} py-2 text-center`}>Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/login" className={`${btnGhost} py-2 text-center`} onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/register" className={`${btnPrimary} text-center`} onClick={() => setMenuOpen(false)}>Register Team</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
