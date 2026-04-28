'use client'

import { useState, useEffect } from 'react'
import styles from './CountdownTimer.module.css'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [time, setTime] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [mounted, setMounted] = useState(false)
  const [ticking, setTicking] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    setTime(getTimeLeft(targetDate))
    
    const timer = setInterval(() => {
      const newTime = getTimeLeft(targetDate)
      // Detect which unit just changed for tick animation
      setTime(prev => {
        if (newTime.seconds !== prev.seconds) setTicking('seconds')
        if (newTime.minutes !== prev.minutes) setTicking('minutes')
        if (newTime.hours !== prev.hours) setTicking('hours')
        if (newTime.days !== prev.days) setTicking('days')
        return newTime
      })
      setTimeout(() => setTicking(null), 300)
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  const units = [
    { label: 'Days',    value: time.days,    key: 'days' },
    { label: 'Hours',   value: time.hours,   key: 'hours' },
    { label: 'Minutes', value: time.minutes, key: 'minutes' },
    { label: 'Seconds', value: time.seconds, key: 'seconds' },
  ]

  const isOver = time.days === 0 && time.hours === 0 && time.minutes === 0 && time.seconds === 0

  if (!mounted) return <div className={styles.countdown} style={{ visibility: 'hidden' }}>Loading...</div>

  if (isOver) {
    return (
      <div className={styles.liveWrapper}>
        <span className={styles.liveDot} />
        <span className={styles.liveText}>HACKATHON IS LIVE!</span>
      </div>
    )
  }

  return (
    <div className={styles.countdown}>
      {units.map((unit, i) => (
        <div key={unit.key} className={styles.unit}>
          <div className={`${styles.valueWrapper} ${ticking === unit.key ? styles.tick : ''}`}>
            <div className={styles.value}>
              {String(unit.value).padStart(2, '0')}
            </div>
            <div className={styles.glassReflect} />
          </div>
          <div className={styles.label}>{unit.label}</div>
          {i < units.length - 1 && (
            <div className={styles.separator}>:</div>
          )}
        </div>
      ))}
    </div>
  )
}
