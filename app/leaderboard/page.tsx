'use client'

import { useEffect, useRef, useState } from 'react'
import Navbar from '@/components/Navbar'
import type { LeaderboardEntry, LeaderboardPool, LeaderboardCategory } from '@/lib/types'

type Pools = Record<LeaderboardPool, Record<LeaderboardCategory, LeaderboardEntry[]>>

const POLL_INTERVAL_MS = 15000

const POOL_LABELS: Record<LeaderboardPool, string> = {
  app_web: 'App / Web Dev',
  game_dev: 'Game Dev',
}

const MEDAL: Record<number, string> = {
  1: 'bg-[#ffd54a]/15 text-[#ffd54a] ring-[#ffd54a]/30',
  2: 'bg-[#c8d2e0]/15 text-[#c8d2e0] ring-[#c8d2e0]/25',
  3: 'bg-[#e8a06a]/15 text-[#e8a06a] ring-[#e8a06a]/25',
}

function FeaturedWinner({ e }: { e: LeaderboardEntry }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-brand/30 bg-gradient-to-br from-brand/[0.14] via-panel to-panel p-4 shadow-glow">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ffd54a]/15 font-display text-xl font-black text-[#ffd54a] ring-1 ring-[#ffd54a]/30">1</div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-brand">Rank 01</div>
          <div className="truncate font-display text-lg font-bold text-ink">{e.team_name}</div>
          <div className="truncate text-sm text-ink-sub">{e.project_name || 'No project submitted'}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-black leading-none text-brand [font-variant-numeric:tabular-nums]">
            {e.total_score.toFixed(1)}
          </div>
          <div className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-ink-dim">points</div>
        </div>
      </div>
    </div>
  )
}

function ContenderRow({ e }: { e: LeaderboardEntry }) {
  const medal = MEDAL[e.rank]
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-panel/60 px-3 py-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${medal ? `ring-1 ${medal}` : 'bg-base text-ink-dim'}`}>
        {e.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{e.team_name}</div>
        <div className="truncate text-xs text-ink-dim">{e.project_name || '—'}</div>
      </div>
      <div className="font-mono text-lg font-bold text-brand-blue [font-variant-numeric:tabular-nums]">
        {e.total_score.toFixed(1)}
      </div>
    </div>
  )
}

function CategoryTable({ label, rows }: { label: string; rows: LeaderboardEntry[] }) {
  const [winner, ...rest] = rows
  return (
    <div className="rounded-card border border-line bg-panel/70 p-3 shadow-panel">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-ink-sub">{label}</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-brand">
          {rows.length} {rows.length === 1 ? 'team' : 'teams'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center font-mono text-xs uppercase tracking-[0.14em] text-ink-dim">
          Awaiting scores
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FeaturedWinner e={winner} />
          {rest.map((e) => (
            <ContenderRow key={e.team_id} e={e} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LeaderboardPage() {
  const [pools, setPools] = useState<Pools | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      if (res.ok) {
        setPools(data.pools)
        setUpdatedAt(data.updatedAt)
      }
    } catch {}
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, POLL_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />

      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(90% 55% at 82% -8%, rgba(47,230,200,0.10), transparent 60%)' }}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-28">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">// Live Standings</p>
          <h1 className="mb-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl [text-wrap:balance]">
            GIIS Hackathon Leaderboard
          </h1>
          <p className="mx-auto max-w-md leading-relaxed text-ink-sub">
            Scores combine judged project criteria with completed Side Quests. Updates automatically throughout the event.
          </p>
          {updatedAt && (
            <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-dim">
              Last updated {new Date(updatedAt).toLocaleTimeString()}
            </p>
          )}
        </header>

        {!pools ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
            Loading leaderboard…
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {(['app_web', 'game_dev'] as const).map((pool) => (
              <section key={pool} className="flex flex-col gap-4">
                <h2 className="text-center font-display text-xl font-bold uppercase tracking-wide text-brand">
                  {POOL_LABELS[pool]}
                </h2>
                {(['Junior', 'Senior'] as const).map((category) => (
                  <CategoryTable key={category} label={category} rows={pools[pool][category]} />
                ))}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
