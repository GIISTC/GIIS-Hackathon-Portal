'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import type { Participant } from '@/lib/types'

type ScanState = 'idle' | 'scanning' | 'success' | 'already' | 'error'

const shell = 'min-h-screen bg-base font-body text-ink'
const main = 'px-4 pb-14 pt-16 lg:ml-60 lg:px-8 lg:pt-8'
const card = 'rounded-card border border-line bg-panel/70 p-5 shadow-panel'

export default function CheckinPage() {
  const router = useRouter()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<any>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<Participant | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [recentCheckins, setRecentCheckins] = useState<Participant[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [adminName, setAdminName] = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (!judge) { router.push('/'); return }
      setAdminName(judge.name)
      loadRecentCheckins()
    }
    init()
  }, [router])

  const loadRecentCheckins = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('participants').select('*, team:teams(team_name)')
      .eq('checked_in', true).order('checked_in_at', { ascending: false }).limit(10)
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
      if (participant.checked_in) { setResult(participant); setScanState('already'); return }

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
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">QR Check-in</h1>
          <p className="text-sm text-ink-sub">Scan participant QR codes to check them in</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* Scanner */}
          <div className={card}>
            <h2 className="mb-3 font-display text-base font-bold text-ink">Scanner</h2>
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

            {scanState === 'success' && result && resultBox('border-good/30', 'bg-good/[0.08]', 'bg-good', result.full_name, `${(result as any).team?.team_name} · ${result.grade}`, 'Checked in successfully.')}
            {scanState === 'already' && result && resultBox('border-warn/30', 'bg-warn/[0.08]', 'bg-warn', result.full_name, `${(result as any).team?.team_name} · ${result.grade}`, `Already checked in at ${result.checked_in_at ? new Date(result.checked_in_at).toLocaleTimeString() : '–'}`)}
            {scanState === 'error' && resultBox('border-bad/30', 'bg-bad/[0.08]', 'bg-bad', 'Scan Failed', undefined, errorMsg)}

            {scanState !== 'idle' && scanState !== 'scanning' && (
              <button onClick={reset} className="mt-4 w-full rounded-lg bg-gradient-to-br from-brand to-brand-blue py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-base transition-opacity hover:opacity-90">
                Scan Next
              </button>
            )}
          </div>

          {/* Recent */}
          <div className={card}>
            <h2 className="mb-3 font-display text-base font-bold text-ink">Recent Check-ins</h2>
            <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto">
              {recentCheckins.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line-soft bg-base/40 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand font-display font-black text-base">{p.full_name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{p.full_name}</div>
                    <div className="truncate text-xs text-ink-dim">{(p as any).team?.team_name} · {p.grade}</div>
                  </div>
                  <div className="font-mono text-[0.66rem] text-brand">
                    {p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'}
                  </div>
                </div>
              ))}
              {recentCheckins.length === 0 && <p className="py-10 text-center text-sm text-ink-dim">No check-ins yet</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
