'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import type { Participant } from '@/lib/types'
import { EVENT_DAYS } from '@/lib/types'

type ScanState = 'idle' | 'scanning' | 'success' | 'already' | 'error'
type EventDay = 1 | 2

// July 31, 2026 -> Day 1; August 1, 2026 -> Day 2; anything else defaults
// to Day 1 (e.g. testing before the event).
const defaultDay = (): EventDay => {
  const now = new Date()
  if (now.getFullYear() === 2026 && now.getMonth() === 7 && now.getDate() === 1) return 2
  return 1
}

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8 [&>*]:mx-auto [&>*]:max-w-6xl'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'

export default function CheckinPage() {
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<any>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<(Participant & { lastCheckinAt?: string | null }) | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [recentCheckins, setRecentCheckins] = useState<any[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [judgeId, setJudgeId] = useState('')
  const [day, setDay] = useState<EventDay>(defaultDay())

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      setJudgeId(user.id)
    }
    init()
  }, [router])

  useEffect(() => {
    if (judgeId) loadRecentCheckins()
  }, [judgeId, day])

  const loadRecentCheckins = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('checkins')
      .select('*, participant:participants(*, team:teams(team_name))')
      .eq('event_day', day)
      .order('checked_in_at', { ascending: false })
      .limit(10)
    setRecentCheckins(data || [])
  }

  const startScanner = async () => {
    if (!scannerRef.current) return
    setIsScanning(true)
    setScanState('scanning')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      html5QrRef.current = new Html5Qrcode('qr-scanner-region')
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess, undefined,
      )
    } catch {
      setErrorMsg('Camera access denied or not available.')
      setScanState('error')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    try {
      if (html5QrRef.current) { await html5QrRef.current.stop(); html5QrRef.current.clear() }
    } catch {}
    setIsScanning(false)
    setScanState('idle')
  }

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner()
    try {
      let token = ''
      try { const payload = JSON.parse(decodedText); token = payload.token || decodedText } catch { token = decodedText }
      if (!token) throw new Error('Invalid QR code')

      const supabase = createClient()
      const { data: participant, error } = await supabase
        .from('participants').select('*, team:teams(team_name)').eq('qr_token', token).single()

      if (error || !participant) { setErrorMsg('Participant not found. Invalid QR code.'); setScanState('error'); return }

      const { data: existing } = await supabase
        .from('checkins').select('checked_in_at').eq('participant_id', participant.id).eq('event_day', day).maybeSingle()

      if (existing) {
        setResult({ ...participant, lastCheckinAt: existing.checked_in_at })
        setScanState('already')
        return
      }

      const { error: insertError } = await supabase
        .from('checkins').insert({ participant_id: participant.id, event_day: day, checked_in_by: judgeId })
      if (insertError) throw insertError

      // Best-effort convenience flag — "checked in at least once" — used
      // by dashboard/admin badges elsewhere that don't care which day.
      await supabase.from('participants')
        .update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq('id', participant.id)

      setResult(participant)
      setScanState('success')
      loadRecentCheckins()
    } catch {
      setErrorMsg('Invalid QR code format.')
      setScanState('error')
    }
  }

  const reset = () => { setScanState('idle'); setResult(null); setErrorMsg('') }

  const resultBox = (border: string, bg: string, accent: string, name: string, meta?: string, status?: string) => (
    <div className={`mt-4 flex items-center gap-3 rounded-lg border ${border} ${bg} p-4`}>
      <div className={`h-10 w-1 shrink-0 rounded-full ${accent}`} />
      <div>
        <div className="font-semibold text-ink">{name}</div>
        {meta && <div className="text-xs text-ink-dim">{meta}</div>}
        {status && <div className="mt-0.5 text-sm text-ink-sub">{status}</div>}
      </div>
    </div>
  )

  return (
    <div className={shell}>
      <AdminNav active="checkin" adminName={adminName} />
      <main className={main}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">QR Check-in</h1>
            <p className="text-sm text-ink-sub">Scan participant QR codes to check them in for the selected day</p>
          </div>
          <div className="flex gap-2">
            {EVENT_DAYS.map((d) => (
              <button key={d.day} onClick={() => { setDay(d.day); reset() }}
                className={`rounded-lg px-4 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] transition-colors ${
                  day === d.day ? 'bg-gradient-to-br from-brand to-brand-blue text-base' : 'border border-line text-brand hover:bg-brand/5'
                }`}>
                {d.label} <span className="opacity-70">· {d.date}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* Scanner */}
          <div className={card}>
            <h2 className="mb-3 font-display text-base font-bold text-ink">Scanner — {EVENT_DAYS.find((d) => d.day === day)?.label}</h2>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-base">
              <div id="qr-scanner-region" ref={scannerRef} className="h-full w-full">
                {scanState === 'idle' && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-dim">
                    <div className="h-12 w-12 rounded-lg border border-dashed border-line" />
                    <p className="font-mono text-xs uppercase tracking-[0.14em]">Camera preview</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              {!isScanning && scanState === 'idle' && (
                <button onClick={startScanner} className="w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90">
                  Start Scanner
                </button>
              )}
              {isScanning && (
                <button onClick={stopScanner} className="w-full rounded-lg border border-line py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5">
                  Stop Scanner
                </button>
              )}
            </div>

            {scanState === 'success' && result && resultBox('border-good/30', 'bg-good/[0.08]', 'bg-good', result.full_name, `${(result as any).team?.team_name} · ${result.grade}`, `Checked in for ${EVENT_DAYS.find((d) => d.day === day)?.label}.`)}
            {scanState === 'already' && result && resultBox('border-warn/30', 'bg-warn/[0.08]', 'bg-warn', result.full_name, `${(result as any).team?.team_name} · ${result.grade}`, `Already checked in for ${EVENT_DAYS.find((d) => d.day === day)?.label} at ${result.lastCheckinAt ? new Date(result.lastCheckinAt).toLocaleTimeString() : '–'}`)}
            {scanState === 'error' && resultBox('border-bad/30', 'bg-bad/[0.08]', 'bg-bad', 'Scan Failed', undefined, errorMsg)}

            {scanState !== 'idle' && scanState !== 'scanning' && (
              <button onClick={reset} className="mt-4 w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90">
                Scan Next
              </button>
            )}
          </div>

          {/* Recent */}
          <div className={card}>
            <h2 className="mb-3 font-display text-base font-bold text-ink">Recent Check-ins — {EVENT_DAYS.find((d) => d.day === day)?.label}</h2>
            <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto">
              {recentCheckins.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-base/40 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand font-display font-black text-base">{c.participant?.full_name?.[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{c.participant?.full_name}</div>
                    <div className="truncate text-xs text-ink-dim">{c.participant?.team?.team_name} · {c.participant?.grade}</div>
                  </div>
                  <div className="font-mono text-[0.66rem] text-brand">
                    {c.checked_in_at ? new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'}
                  </div>
                </div>
              ))}
              {recentCheckins.length === 0 && <p className="py-10 text-center text-sm text-ink-dim">No check-ins yet for this day</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
