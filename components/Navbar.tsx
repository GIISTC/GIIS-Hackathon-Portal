'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let lastY = window.scrollY
    const handleScroll = () => {
      const currentY = window.scrollY
      setScrolled(currentY > 30)
      setHidden(currentY > lastY && currentY > 120)
      lastY = currentY
    }
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
        // Check if judge silently
        const { data: judgeData } = await supabase
          .from('judges')
          .select('id')
          .eq('id', user.id)
          .maybeSingle() // maybeSingle doesn't throw error if not found
        
        if (judgeData) setIsAdmin(true)
      } catch (err) {
        // Silent fail for background auth checks
      }
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

  const isActive = (href: string) => pathname === href

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''} ${hidden ? styles.hidden : ''}`}>
      <div className={styles.navInner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>⟨/⟩</span>
          <span className={styles.logoText}>GIIS<span className={styles.logoAccent}>HACK</span></span>
          <span className={styles.logoBadge}>2K26</span>
        </Link>

        {/* Nav Links */}
        <ul className={`${styles.navLinks} ${menuOpen ? styles.open : ''}`}>
          {[
            { href: '/#about', label: 'About' },
            { href: '/#schedule', label: 'Schedule' },
            { href: '/#tracks', label: 'Tracks' },
            { href: '/#faq', label: 'FAQ' },
          ].map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={styles.navLink}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className={styles.navActions}>
          {user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className={`btn btn-outline btn-sm ${styles.btnNav}`}>
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className={`btn btn-outline btn-sm ${styles.btnNav}`}>
                Dashboard
              </Link>
              <button onClick={handleSignOut} className={`btn btn-ghost btn-sm ${styles.btnNav}`}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={`btn btn-ghost btn-sm ${styles.btnNav}`}>
                Login
              </Link>
              <Link href="/register" className={`btn btn-primary btn-sm ${styles.btnNav}`}>
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className={styles.mobileToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {[
            { href: '/#about', label: 'About' },
            { href: '/#schedule', label: 'Schedule' },
            { href: '/#tracks', label: 'Tracks' },
            { href: '/#faq', label: 'FAQ' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className={styles.mobileCta}>
            {user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" className="btn btn-outline btn-full" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>
                )}
                <Link href="/dashboard" className="btn btn-outline btn-full" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleSignOut} className="btn btn-ghost btn-full">Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-full" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/register" className="btn btn-primary btn-full" onClick={() => setMenuOpen(false)}>Register Team</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
