'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import styles from './page.module.css'

export default function JudgingPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  
  const [projectA, setProjectA] = useState<any>(null)
  const [projectB, setProjectB] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [view, setView] = useState<'judge' | 'leaderboard'>('judge')
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    // Basic auth check can still rely on user presence, but the API secures the actual voting
    const init = async () => {
      // Just check if we are logged in, API does the rest
      fetchPair()
      fetchStats()
    }
    init()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/judging-stats')
      const data = await res.json()
      if (res.ok) setStats(data)
    } catch (e) {}
  }

  const fetchPair = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/judge/pair')
      const data = await res.json()
      
      if (!res.ok) {
        setErrorMsg(data.error)
        setLoading(false)
        return
      }

      setProjectA(data.projectA)
      setProjectB(data.projectB)
      setLoading(false)
    } catch (err: any) {
      setErrorMsg('Failed to load projects. Please try again.')
      setLoading(false)
    }
  }

  const loadLeaderboard = async () => {
    setView('leaderboard')
    setLoading(true)
    try {
      // Fetch directly from supabase or a new api, for simplicity we can just fetch all submissions here 
      // but wait, we need supabase client for that.
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: judge } = await supabase.from('judges').select('*').eq('id', user.id).single()
      if (judge) setAdminName(judge.name)

      const { data, error } = await supabase
        .from('submissions')
        .select('*, team:teams(team_name)')
        .order('elo_rating', { ascending: false })
      
      if (!error && data) {
        setLeaderboard(data)
      }
    } catch (e) {}
    setLoading(false)
  }

  const handleVote = async (winnerId: string, loserId: string | null, skip: boolean = false) => {
    setVoting(true)
    try {
      const res = await fetch('/api/judge/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner_id: winnerId, loser_id: loserId, skip })
      })
      if (res.ok) {
        await fetchPair() // fetch next pair
        fetchStats() // update health stats
      } else {
        const data = await res.json()
        setErrorMsg(data.error)
      }
    } catch (err) {
      setErrorMsg('Vote failed.')
    }
    setVoting(false)
  }

  if (loading && view === 'judge' && !projectA) {
    return (
      <div className={styles.adminWrapper}>
        <AdminNav active="judging" adminName={adminName || 'Admin'} />
        <main className={styles.adminMain}>
          <div className="loading-overlay"><div className="spinner" /><span>Finding projects...</span></div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.adminWrapper}>
      <AdminNav active="judging" adminName={adminName || 'Admin'} />
      <main className={styles.adminMain}>
        
        {/* GAVEL HEALTH MONITOR */}
        <div className={styles.healthMonitor}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Confidence</span>
            <span className={`${styles.statValue} ${stats?.isReady ? styles.ready : ''}`}>
              {stats?.status || 'Calculating...'}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Avg Matches</span>
            <span className={styles.statValue}>{stats?.avgMatches || '0'}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Total Votes</span>
            <span className={styles.statValue}>{stats?.totalVotes || '0'}</span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${stats?.progress || 0}%` }}></div>
            </div>
            <span className={styles.progressText}>{stats?.progress || 0}% Finalized</span>
          </div>
        </div>

        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Project Judging</h1>
            <p className={styles.pageSub}>Official Gavel Logic Enabled</p>
          </div>
          <div className={styles.viewToggle}>
            <button 
              className={`btn btn-sm ${view === 'judge' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setView('judge'); fetchPair(); }}
            >
              ⚖️ Judge
            </button>
            <button 
              className={`btn btn-sm ${view === 'leaderboard' ? 'btn-primary' : 'btn-outline'}`}
              onClick={loadLeaderboard}
            >
              🏆 Leaderboard
            </button>
          </div>
        </div>

        {view === 'judge' && (
          <div className={styles.judgingContainer}>
            {errorMsg ? (
              <div className={`card ${styles.scoringEmpty}`}>
                <div style={{ fontSize: '3rem' }}>🤷‍♂️</div>
                <h3>{errorMsg}</h3>
                <p>Wait for more teams to submit their projects.</p>
                <button className="btn btn-outline" onClick={fetchPair}>↻ Refresh</button>
              </div>
            ) : (
              <div className={styles.gavelLayout}>
                <div className={styles.gavelInstructions}>
                  <h3>Which project is better?</h3>
                  <p>Review both projects below and select the winner. Your vote affects their global ranking.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleVote('', '', true)} disabled={voting}>
                    ⏭ Skip this pair
                  </button>
                </div>

                <div className={styles.gavelProjects}>
                  {/* Project A */}
                  <div className={`card ${styles.gavelCard}`}>
                    <div className={styles.gavelCardHeader}>
                      <span className={styles.teamTag}>{projectA?.team?.team_name}</span>
                      <h2 className={styles.gavelProjectName}>{projectA?.project_name}</h2>
                    </div>
                    <div className={styles.gavelDesc}>
                      {projectA?.description}
                    </div>
                    <div className={styles.gavelLinks}>
                      {projectA?.github_url && <a href={projectA.github_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">GitHub</a>}
                      {projectA?.demo_url && <a href={projectA.demo_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Demo</a>}
                      {projectA?.drive_url && <a href={projectA.drive_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Drive</a>}
                    </div>
                    <button 
                      className={`btn btn-primary btn-full ${styles.voteBtn}`}
                      onClick={() => handleVote(projectA.id, projectB.id)}
                      disabled={voting}
                    >
                      {voting ? 'Voting...' : '👈 Vote for A'}
                    </button>
                  </div>

                  <div className={styles.gavelVs}>VS</div>

                  {/* Project B */}
                  <div className={`card ${styles.gavelCard}`}>
                    <div className={styles.gavelCardHeader}>
                      <span className={styles.teamTag}>{projectB?.team?.team_name}</span>
                      <h2 className={styles.gavelProjectName}>{projectB?.project_name}</h2>
                    </div>
                    <div className={styles.gavelDesc}>
                      {projectB?.description}
                    </div>
                    <div className={styles.gavelLinks}>
                      {projectB?.github_url && <a href={projectB.github_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">GitHub</a>}
                      {projectB?.demo_url && <a href={projectB.demo_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Demo</a>}
                      {projectB?.drive_url && <a href={projectB.drive_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Drive</a>}
                    </div>
                    <button 
                      className={`btn btn-primary btn-full ${styles.voteBtn}`}
                      onClick={() => handleVote(projectB.id, projectA.id)}
                      disabled={voting}
                    >
                      {voting ? 'Voting...' : 'Vote for B 👉'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className={`card ${styles.leaderboardCard}`}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th>Team</th>
                    <th>Project</th>
                    <th>Rating</th>
                    <th>Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((sub, index) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 800, color: index < 3 ? 'var(--color-accent)' : 'inherit' }}>#{index + 1}</td>
                      <td style={{ fontWeight: 600 }}>{sub.team?.team_name}</td>
                      <td>{sub.project_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-accent-3)' }}>{Math.round(sub.elo_rating || 1200)}</td>
                      <td>{sub.matches_played || 0}</td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No submissions to rank yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
