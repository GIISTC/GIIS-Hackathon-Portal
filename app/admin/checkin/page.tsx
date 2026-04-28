'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import type { Participant } from '@/lib/types'
import styles from './page.module.css'

type ScanState = 'idle' | 'scanning' | 'success' | 'already' | 'error'

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
      .from('participants')
      .select('*, team:teams(team_name)')
      .eq('checked_in', true)
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
        onScanSuccess,
        undefined,
      )
    } catch (err: any) {
      setErrorMsg('Camera access denied or not available.')
      setScanState('error')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop()
        html5QrRef.current.clear()
      }
    } catch {}
    setIsScanning(false)
    setScanState('idle')
  }

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner()
    try {
      let token = ''
      try {
        const payload = JSON.parse(decodedText)
        token = payload.token || decodedText
      } catch {
        token = decodedText // Fallback to raw string
      }
      
      if (!token) throw new Error('Invalid QR code')

      const supabase = createClient()
      const { data: participant, error } = await supabase
        .from('participants')
        .select('*, team:teams(team_name)')
        .eq('qr_token', token)
        .single()

      if (error || !participant) {
        setErrorMsg('Participant not found. Invalid QR code.')
        setScanState('error')
        return
      }

      if (participant.checked_in) {
        setResult(participant)
        setScanState('already')
        return
      }

      // Mark as checked in
      await supabase
        .from('participants')
        .update({ checked_in: true, checked_in_at: new Date().toISOString() })
        .eq('id', participant.id)

      setResult(participant)
      setScanState('success')
      loadRecentCheckins()
    } catch (err) {
      setErrorMsg('Invalid QR code format.')
      setScanState('error')
    }
  }

  const reset = () => {
    setScanState('idle')
    setResult(null)
    setErrorMsg('')
  }

  return (
    <div className={styles.adminWrapper}>
      <AdminNav active="checkin" adminName={adminName} />
      <main className={styles.adminMain}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>QR Check-in</h1>
            <p className={styles.pageSub}>Scan participant QR codes to check them in</p>
          </div>
        </div>

        <div className={styles.checkinLayout}>
          {/* Scanner */}
          <div className={`card ${styles.scannerCard}`}>
            <h3 className={styles.cardTitle}>Scanner</h3>

            {/* Scanner Area */}
            <div className={styles.scannerWrapper}>
              <div id="qr-scanner-region" ref={scannerRef} className={styles.scannerRegion}>
                {scanState === 'idle' && (
                  <div className={styles.scannerPlaceholder}>
                    <div className={styles.scannerIcon}>📷</div>
                    <p>Camera preview will appear here</p>
                  </div>
                )}
              </div>

              {/* Corner markers */}
              {isScanning && (
                <div className={styles.cornerMarkers}>
                  <div className={`${styles.corner} ${styles.cornerTL}`} />
                  <div className={`${styles.corner} ${styles.cornerTR}`} />
                  <div className={`${styles.corner} ${styles.cornerBL}`} />
                  <div className={`${styles.corner} ${styles.cornerBR}`} />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className={styles.scannerControls}>
              {!isScanning && scanState === 'idle' && (
                <button className="btn btn-primary btn-full" onClick={startScanner}>
                  📷 Start Scanner
                </button>
              )}
              {isScanning && (
                <button className="btn btn-outline btn-full" onClick={stopScanner}>
                  ⏹ Stop Scanner
                </button>
              )}
            </div>

            {/* Result */}
            {scanState === 'success' && result && (
              <div className={`${styles.resultCard} ${styles.resultSuccess}`}>
                <div className={styles.resultIcon}>✅</div>
                <div className={styles.resultInfo}>
                  <div className={styles.resultName}>{result.full_name}</div>
                  <div className={styles.resultMeta}>{(result as any).team?.team_name} · {result.grade}</div>
                  <div className={styles.resultStatus}>Checked in successfully!</div>
                </div>
              </div>
            )}

            {scanState === 'already' && result && (
              <div className={`${styles.resultCard} ${styles.resultWarning}`}>
                <div className={styles.resultIcon}>⚠️</div>
                <div className={styles.resultInfo}>
                  <div className={styles.resultName}>{result.full_name}</div>
                  <div className={styles.resultMeta}>{(result as any).team?.team_name} · {result.grade}</div>
                  <div className={styles.resultStatus}>Already checked in at {result.checked_in_at ? new Date(result.checked_in_at).toLocaleTimeString() : '–'}</div>
                </div>
              </div>
            )}

            {scanState === 'error' && (
              <div className={`${styles.resultCard} ${styles.resultError}`}>
                <div className={styles.resultIcon}>❌</div>
                <div className={styles.resultInfo}>
                  <div className={styles.resultName}>Scan Failed</div>
                  <div className={styles.resultStatus}>{errorMsg}</div>
                </div>
              </div>
            )}

            {scanState !== 'idle' && scanState !== 'scanning' && (
              <button className="btn btn-primary btn-full" onClick={reset} style={{ marginTop: 16 }}>
                📷 Scan Next
              </button>
            )}
          </div>

          {/* Recent Check-ins */}
          <div className={`card ${styles.recentCard}`}>
            <h3 className={styles.cardTitle}>Recent Check-ins</h3>
            <div className={styles.recentList}>
              {recentCheckins.map((p) => (
                <div key={p.id} className={styles.recentItem}>
                  <div className={styles.recentAvatar}>{p.full_name[0]}</div>
                  <div className={styles.recentInfo}>
                    <div className={styles.recentName}>{p.full_name}</div>
                    <div className={styles.recentMeta}>
                      {(p as any).team?.team_name} · {p.grade}
                    </div>
                  </div>
                  <div className={styles.recentTime}>
                    {p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'}
                  </div>
                </div>
              ))}
              {recentCheckins.length === 0 && (
                <p style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '40px 0' }}>
                  No check-ins yet
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
