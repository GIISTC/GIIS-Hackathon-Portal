'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Participant, Team, Submission } from '@/lib/types'
import styles from './page.module.css'

export default function DashboardPage() {
  const router = useRouter()
  const qrRef = useRef<HTMLCanvasElement>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teammates, setTeammates] = useState<Participant[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)
  const [switchCode, setSwitchCode] = useState('')
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [showSwitch, setShowSwitch] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [teamSwitchingEnabled, setTeamSwitchingEnabled] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      // Check global settings
      const { data: settingRow, error: settingError } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'team_switching_enabled')
        .maybeSingle()
      
      if (settingError) {
        console.error("RLS Error reading team settings:", settingError.message)
      }

      if (settingRow) {
        setTeamSwitchingEnabled(settingRow.value === true)
      } else {
        setTeamSwitchingEnabled(false)
      }

      // Load participant
      const { data: part, error: partError } = await supabase
        .from('participants')
        .select('*, team:teams(*)')
        .eq('id', user.id)
        .single()

      if (partError || !part) {
        // Participant record is missing (possibly due to the previous bug)
        setNeedsProfile(true)
        setLoading(false)
        return
      }
      
      setParticipant(part)
      setTeam(part.team as unknown as Team)

      // Load teammates
      const { data: mates } = await supabase
        .from('participants')
        .select('*')
        .eq('team_id', part.team_id)
        .neq('id', user.id)
      setTeammates(mates || [])

      // Load submission
      const { data: sub } = await supabase
        .from('submissions')
        .select('*')
        .eq('team_id', part.team_id)
        .single()
      setSubmission(sub)

      setLoading(false)

      // Generate QR code after data loads
      if (part.qr_token) {
        generateQR(part.qr_token, part.full_name)
      }
    }
    load()
  }, [router])

  const generateQR = async (token: string, name: string) => {
    if (!qrRef.current) return
    try {
      const QRCode = (await import('qrcode')).default
      const payload = JSON.stringify({ token, name })
      await QRCode.toCanvas(qrRef.current, payload, {
        width: 280,
        margin: 2,
        color: {
          dark: '#00d4b4',
          light: '#030d1a',
        },
      })
      setQrGenerated(true)
    } catch (err) {
      console.error('QR generation error:', err)
    }
  }

  const downloadQR = () => {
    if (!qrRef.current || !participant) return
    const link = document.createElement('a')
    link.download = `GIIS-Hack-2K26-QR-${participant.full_name.replace(/\s+/g, '-')}.png`
    link.href = qrRef.current.toDataURL('image/png')
    link.click()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSwitchTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!switchCode.trim() || switchCode.trim().toUpperCase() === team?.team_code) return
    
    setSwitchLoading(true)
    setSwitchError(null)
    const supabase = createClient()

    try {
      // 1. Find new team
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .select('*, participants(id)')
        .eq('team_code', switchCode.trim().toUpperCase())
        .single()

      if (teamErr || !newTeam) throw new Error('Invalid Team Code.')
      if (newTeam.participants.length >= 4) throw new Error('Target team is already full.')

      const oldTeamId = team?.id
      const myId = participant?.id

      // 2. MOVE the participant to the new team FIRST
      const { error: updateErr } = await supabase
        .from('participants')
        .update({ team_id: newTeam.id, is_team_leader: false })
        .eq('id', myId)

      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`)

      // 3. NOW safely clean up the old team if it is empty
      if (oldTeamId) {
        const { data: remainingMembers } = await supabase
          .from('participants')
          .select('id')
          .eq('team_id', oldTeamId)

        if (!remainingMembers || remainingMembers.length === 0) {
          // No one is left in the old team, safe to delete
          await supabase.from('submissions').delete().eq('team_id', oldTeamId)
          await supabase.from('teams').delete().eq('id', oldTeamId)
        } else {
          // If the old team still has people, ensure there is a leader
          const hasLeader = await supabase
            .from('participants')
            .select('id')
            .eq('team_id', oldTeamId)
            .eq('is_team_leader', true)
            .single()

          if (!hasLeader.data) {
            await supabase.from('participants')
              .update({ is_team_leader: true })
              .eq('id', remainingMembers[0].id)
          }
        }
      }

      window.location.reload()
    } catch (err: any) {
      setSwitchError(err.message)
      setSwitchLoading(false)
    }
  }

  const handleRepairProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const fullName = formData.get('fullname') as string
    const grade = formData.get('grade') as string
    const code = switchCode.trim().toUpperCase()

    setSwitchLoading(true)
    setSwitchError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    try {
      if (!user) throw new Error('Not authenticated.')
      if (!code) throw new Error('Team code is required.')
      
      // 1. Find team
      const { data: targetTeam, error: teamErr } = await supabase
        .from('teams')
        .select('*, participants(id)')
        .eq('team_code', code)
        .single()

      if (teamErr || !targetTeam) throw new Error('Invalid Team Code.')
      if (targetTeam.participants.length >= 4) throw new Error('Team is full.')

      // 2. Create participant record
      const { error: partError } = await supabase
        .from('participants')
        .insert({
          id: user.id,
          team_id: targetTeam.id,
          full_name: fullName,
          email: user.email,
          grade: grade,
          qr_token: crypto.randomUUID(),
          is_team_leader: false
        })

      if (partError) throw new Error(partError.message)

      window.location.reload()
    } catch (err: any) {
      setSwitchError(err.message)
      setSwitchLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className={styles.wrapper}>
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Loading your dashboard...</span>
          </div>
        </div>
      </>
    )
  }

  if (needsProfile) {
    return (
      <>
        <Navbar />
        <div className={styles.wrapper}>
          <div className={styles.repairContainer}>
            <div className={`card ${styles.repairCard}`}>
              <h2 className={styles.repairTitle}>Finish Your Profile</h2>
              <p className={styles.repairSub}>
                Your account exists but we couldn{"'"}t find your team details. Let{"'"}s fix that!
              </p>
              
              <form onSubmit={handleRepairProfile} className={styles.form}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="text" className="form-control" value={userEmail} disabled />
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="fullname">Full Name *</label>
                  <input id="fullname" name="fullname" type="text" className="form-control" required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="grade">Grade *</label>
                  <select id="grade" name="grade" className="form-control" required>
                    <option value="" disabled>Select grade</option>
                    {['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="code">Team Code to Join *</label>
                  <input 
                    id="code" 
                    type="text" 
                    className="form-control" 
                    placeholder="XJ29B1" 
                    value={switchCode}
                    onChange={e => setSwitchCode(e.target.value)}
                    required 
                  />
                </div>

                {switchError && <p className="alert alert-error">{switchError}</p>}

                <button type="submit" className="btn btn-primary btn-full" disabled={switchLoading}>
                  {switchLoading ? 'Repairing...' : '🚀 Complete Registration'}
                </button>
                
                <button type="button" className="btn btn-ghost btn-full" onClick={handleSignOut}>
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className={styles.wrapper}>
        <div className={styles.dashboardGrid}>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className={styles.sidebar}>
            {/* QR Card */}
            <div className={`card ${styles.qrCard}`}>
              <div className={styles.qrHeader}>
                <p className="section-label" style={{ marginBottom: 0 }}>Your Pass</p>
                {participant?.checked_in && (
                  <span className="badge badge-success">✓ Checked In</span>
                )}
              </div>
              <div className={styles.qrWrapper}>
                <canvas ref={qrRef} className={styles.qrCanvas} />
                {!qrGenerated && (
                  <div className={styles.qrPlaceholder}>
                    <div className="spinner" />
                  </div>
                )}
                <div className={styles.scanLine} />
              </div>
              <div className={styles.qrInfo}>
                <p className={styles.qrName}>{participant?.full_name}</p>
                <p className={styles.qrTeam}>{team?.team_name}</p>
                <p className={styles.qrGrade}>{participant?.grade}</p>
              </div>
              <button
                className="btn btn-outline btn-full btn-sm"
                onClick={downloadQR}
                disabled={!qrGenerated}
              >
                ⬇ Download QR Code
              </button>
              <p className={styles.qrNote}>
                Use this QR code for check-in, food collection, and event access.
              </p>
            </div>

            {/* Nav Links */}
            <div className={`card ${styles.navCard}`}>
              <nav className={styles.dashNav}>
                <Link href="/dashboard" className={`${styles.dashNavLink} ${styles.dashNavActive}`}>
                  <span>🏠</span> Dashboard
                </Link>
                <Link href="/dashboard/submit" className={styles.dashNavLink}>
                  <span>📦</span> Submit Project
                </Link>
                <button onClick={handleSignOut} className={`${styles.dashNavLink} ${styles.dashNavSignout}`}>
                  <span>🚪</span> Sign Out
                </button>
              </nav>
            </div>
          </aside>

          {/* ── Main Content ───────────────────────────────── */}
          <main className={styles.main}>
            {/* Welcome */}
            <div className={styles.welcomeBar}>
              <div>
                <h1 className={styles.welcomeTitle}>
                  Hey, <span className="text-accent">{participant?.full_name.split(' ')[0]}</span> 👋
                </h1>
                <p className={styles.welcomeSub}>Welcome to GIIS Hackathon 2K26 participant portal</p>
              </div>
              <div className={styles.welcomeDate}>
                <span className="badge badge-teal">📅 Jul 31 – Aug 1</span>
              </div>
            </div>

            {/* Status Cards */}
            <div className={styles.statusGrid}>
              <div className={`card ${styles.statusCard}`}>
                <div className={styles.statusIcon}>👥</div>
                <div className={styles.statusLabel}>Team</div>
                <div className={styles.statusValue}>{team?.team_name}</div>
              </div>
              <div className={`card ${styles.statusCard}`}>
                <div className={styles.statusIcon}>📋</div>
                <div className={styles.statusLabel}>Members</div>
                <div className={styles.statusValue}>{teammates.length + 1} / 4</div>
              </div>
              <div className={`card ${styles.statusCard}`}>
                <div className={styles.statusIcon}>{participant?.checked_in ? '✅' : '⏳'}</div>
                <div className={styles.statusLabel}>Check-in</div>
                <div className={styles.statusValue}>
                  {participant?.checked_in ? 'Done' : 'Pending'}
                </div>
              </div>
              <div className={`card ${styles.statusCard}`}>
                <div className={styles.statusIcon}>{submission ? '🚀' : '📝'}</div>
                <div className={styles.statusLabel}>Submission</div>
                <div className={styles.statusValue}>
                  {submission ? 'Submitted' : 'Not yet'}
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className={`card ${styles.sectionCard}`}>
              <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                <h3 className={styles.cardTitle}>Team Members</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {teamSwitchingEnabled ? (
                    <button 
                      className={`badge ${showSwitch ? 'badge-error' : 'badge-teal'}`} 
                      onClick={() => setShowSwitch(!showSwitch)}
                      style={{ cursor: 'pointer', border: '1px solid var(--color-accent)', background: 'transparent', transition: 'all 0.2s' }}
                    >
                      {showSwitch ? '✕ Close' : '🔗 Join Different Team'}
                    </button>
                  ) : (
                    <span className="badge" style={{ opacity: 0.6, border: '1px solid var(--color-border)' }}>🔒 Teams Locked</span>
                  )}
                  <span className="badge badge-teal">{teammates.length + 1} Members</span>
                </div>
              </div>

              {showSwitch && (
                <form onSubmit={handleSwitchTeam} className={styles.switchBox}>
                  <p className={styles.switchLabel}>Join a different team using their code:</p>
                  <div className={styles.switchInputGroup}>
                    <input 
                      type="text" 
                      placeholder="ENTER CODE" 
                      className="form-control"
                      value={switchCode}
                      onChange={e => setSwitchCode(e.target.value)}
                      maxLength={6}
                    />
                    <button type="submit" className="btn btn-primary" disabled={switchLoading}>
                      {switchLoading ? 'Joining...' : 'Join Team'}
                    </button>
                  </div>
                  {switchError && <p className={styles.switchError}>{switchError}</p>}
                  <p className={styles.switchNote}>⚠️ You will lose access to your current team{"'"}s project submission.</p>
                </form>
              )}

              <div className={styles.membersList}>
                {/* Self */}
                <div className={styles.memberRow}>
                  <div className={styles.memberAvatar}>{participant?.full_name[0]}</div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{participant?.full_name} <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>You</span></span>
                    <span className={styles.memberMeta}>{participant?.grade} · {participant?.email}</span>
                  </div>
                  {participant?.is_team_leader && <span className="badge badge-teal">Leader</span>}
                </div>
                {/* Teammates */}
                {teammates.map((t) => (
                  <div key={t.id} className={styles.memberRow}>
                    <div className={styles.memberAvatar}>{t.full_name[0]}</div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{t.full_name}</span>
                      <span className={styles.memberMeta}>{t.grade} · {t.email}</span>
                    </div>
                    {t.is_team_leader && <span className="badge badge-teal">Leader</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Status */}
            <div className={`card ${styles.sectionCard}`}>
              <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                <h3 className={styles.cardTitle}>Project Submission</h3>
                <span className={`badge ${submission ? 'badge-success' : 'badge-warning'}`}>
                  {submission ? '✓ Submitted' : 'Not Submitted'}
                </span>
              </div>

              {submission ? (
                <div className={styles.submissionPreview}>
                  <h4 className={styles.submissionName}>{submission.project_name}</h4>
                  <p className={styles.submissionDesc}>{submission.description.substring(0, 150)}...</p>
                  <div className={styles.submissionLinks}>
                    {submission.github_url && (
                      <a href={submission.github_url} target="_blank" className={styles.linkChip}>
                        🔗 GitHub Repository
                      </a>
                    )}
                    {submission.drive_url && (
                      <a href={submission.drive_url} target="_blank" className={styles.linkChip}>
                        📁 Drive Link
                      </a>
                    )}
                    {submission.demo_url && (
                      <a href={submission.demo_url} target="_blank" className={styles.linkChip}>
                        🎬 Demo Video
                      </a>
                    )}
                  </div>
                  <Link href="/dashboard/submit" className="btn btn-outline btn-sm">
                    Edit Submission
                  </Link>
                </div>
              ) : (
                <div className={styles.noSubmission}>
                  <p>Your team hasn{"'"}t submitted a project yet. Submissions open during the hackathon.</p>
                  <Link href="/dashboard/submit" className="btn btn-primary">
                    🚀 Submit Project
                  </Link>
                </div>
              )}
            </div>

            {/* Hackathon Info */}
            <div className={`card ${styles.sectionCard} ${styles.infoCard}`}>
              <h3 className={styles.cardTitle}>📋 Quick Info</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Team Code</span>
                  <span className={styles.infoCode}>{team?.team_code}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Event Dates</span>
                  <span>July 31 – August 1, 2026</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Check-in Time</span>
                  <span>8:00 AM, July 31</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Submission Deadline</span>
                  <span>12:00 PM, August 1</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
