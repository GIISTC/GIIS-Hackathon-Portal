'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import type { ApprovalStatus } from '@/lib/types'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'
const smBtn = 'rounded-lg px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] transition-colors'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  pending: 'bg-warn/15 text-warn',
  approved: 'bg-good/15 text-good',
  rejected: 'bg-bad/15 text-bad',
}

export default function ApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('')
  const [isOT, setIsOT] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [busy, setBusy] = useState<string | null>(null)

  const loadParticipants = async () => {
    const res = await fetch('/api/admin/approvals')
    const data = await res.json()
    if (res.ok) setParticipants(data)
  }

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      setIsOT(judge.role === 'ot')
      if (judge.role === 'ot') await loadParticipants()
      setLoading(false)
    }
    init()
  }, [router])

  const setStatus = async (id: string, approval_status: ApprovalStatus) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/approvals/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approval_status }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      await loadParticipants()
    } catch (err: any) {
      alert(err.message || 'Failed to update approval status.')
    }
    setBusy(null)
  }

  const filtered = participants.filter((p) => filter === 'all' || p.approval_status === filter)
  const pendingCount = participants.filter((p) => p.approval_status === 'pending').length

  if (loading) {
    return (
      <div className={shell}>
        <AdminNav active="approvals" adminName={adminName} />
        <main className={main}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />Loading…
          </div>
        </main>
      </div>
    )
  }

  if (!isOT) {
    return (
      <div className={shell}>
        <AdminNav active="approvals" adminName={adminName} />
        <main className={main}>
          <div className={`${card} flex flex-col items-center gap-3 py-16 text-center`}>
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-warn">Restricted</div>
            <h2 className="font-display text-xl font-bold text-ink">OT Access Only</h2>
            <p className="max-w-md text-ink-sub">Approving new registrations is restricted to OT (Organizing Team) members.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shell}>
      <AdminNav active="approvals" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Approvals</h1>
            <p className="text-sm text-ink-sub">New registrations wait here until an OT member approves them</p>
          </div>
          {pendingCount > 0 && (
            <span className="rounded-full bg-warn/15 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase text-warn">
              {pendingCount} awaiting review
            </span>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`${smBtn} border ${filter === f ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line text-ink-sub hover:text-ink'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <div key={p.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold text-ink">{p.full_name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase ${STATUS_BADGE[p.approval_status as ApprovalStatus]}`}>
                      {p.approval_status}
                    </span>
                    {p.is_team_leader && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase text-brand">Leader</span>}
                  </div>
                  <div className="mt-1 text-xs text-ink-dim">
                    {p.email} · {p.grade} · {p.team?.team_name || 'No team'} {p.team?.team_code && `(${p.team.team_code})`}
                  </div>
                  <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-dim">
                    Registered {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {p.approval_status !== 'approved' && (
                    <button onClick={() => setStatus(p.id, 'approved')} disabled={busy === p.id}
                      className={`${smBtn} bg-gradient-to-br from-brand to-brand-blue text-base`}>Approve</button>
                  )}
                  {p.approval_status !== 'rejected' && (
                    <button onClick={() => setStatus(p.id, 'rejected')} disabled={busy === p.id}
                      className={`${smBtn} border border-bad/40 text-bad hover:bg-bad/10`}>Reject</button>
                  )}
                  {p.approval_status !== 'pending' && (
                    <button onClick={() => setStatus(p.id, 'pending')} disabled={busy === p.id}
                      className={`${smBtn} border border-line text-ink-sub hover:text-ink`}>Reset</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className={`${card} text-center text-sm text-ink-dim`}>No {filter === 'all' ? '' : filter} registrations.</p>}
        </div>
      </main>
    </div>
  )
}
