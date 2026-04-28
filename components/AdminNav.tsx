'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './AdminNav.module.css'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: '📊', key: 'overview' },
  { href: '/admin/teams', label: 'Teams', icon: '👥', key: 'teams' },
  { href: '/admin/checkin', label: 'Check-in', icon: '📷', key: 'checkin' },
  { href: '/admin/submissions', label: 'Submissions', icon: '📦', key: 'submissions' },
  { href: '/admin/judging', label: 'Judging', icon: '⚖️', key: 'judging' },
]

export default function AdminNav({ active, adminName }: { active: string; adminName?: string }) {
  const router = useRouter()

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoGlyph}>⚙</span>
        <div>
          <div className={styles.logoText}>ADMIN</div>
          <div className={styles.logoSub}>GIIS HACK 2K26</div>
        </div>
      </div>

      {adminName && (
        <div className={styles.adminBadge}>
          <div className={styles.adminAvatar}>{adminName[0]}</div>
          <div>
            <div className={styles.adminName}>{adminName}</div>
            <div className={styles.adminRole}>OT Member</div>
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.key}
            href={item.href}
            className={`${styles.navItem} ${active === item.key ? styles.navActive : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.bottom}>
        <Link href="/" className={styles.bottomLink}>← Public Site</Link>
        <button onClick={signOut} className={styles.bottomLink}>Sign Out</button>
      </div>
    </aside>
  )
}
