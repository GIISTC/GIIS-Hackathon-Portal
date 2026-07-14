'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', key: 'overview' },
  { href: '/admin/teams', label: 'Teams', key: 'teams' },
  { href: '/admin/checkin', label: 'Check-in', key: 'checkin' },
  { href: '/admin/submissions', label: 'Submissions', key: 'submissions' },
  { href: '/admin/judging', label: 'Judging', key: 'judging' },
  { href: '/admin/side-quests', label: 'Side Quests', key: 'sidequests' },
]

export default function AdminNav({ active, adminName }: { active: string; adminName?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] transition-colors ${
            active === item.key
              ? 'border-l-2 border-brand bg-brand/10 text-brand'
              : 'border-l-2 border-transparent text-ink-sub hover:bg-panel hover:text-ink'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active === item.key ? 'bg-brand' : 'bg-line'}`} />
          {item.label}
        </Link>
      ))}
    </nav>
  )

  const body = (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center gap-3">
        <img src="/logo.png" alt="GIIS Hackathon" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
        <div>
          <div className="font-display text-sm font-bold tracking-wide text-ink">ADMIN</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">GIIS Hackathon 2K26</div>
        </div>
      </div>

      {adminName && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-panel/60 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand font-display font-black text-base">
            {adminName[0]}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{adminName}</div>
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-brand">OT Member</div>
          </div>
        </div>
      )}

      {nav}

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <Link href="/" className="rounded-lg px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-ink">
          ← Public Site
        </Link>
        <button onClick={signOut} className="rounded-lg px-3 py-2 text-left font-mono text-[0.68rem] uppercase tracking-[0.12em] text-bad/80 transition-colors hover:text-bad">
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-base/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-display text-sm font-bold tracking-wide text-ink">ADMIN</span>
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu" className="text-xl text-ink">{open ? '✕' : '☰'}</button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 bg-base/95 p-5 pt-16 backdrop-blur lg:hidden">{body}</div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-60 border-r border-line bg-base/80 p-5 backdrop-blur lg:block">
        {body}
      </aside>
    </>
  )
}
