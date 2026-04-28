import Link from 'next/link'
import Navbar from '@/components/Navbar'
import CountdownTimer from '@/components/CountdownTimer'
import HeroCanvas from '@/components/HeroCanvas'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <HeroCanvas />
        <div className={styles.heroContent}>
          <div className="tag-pill animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            <span>⚡</span> GIIS Tech Club Presents
          </div>

          <h1 className={`${styles.heroHeading} animate-glitch`}>
            GIIS<br />
            <span className="gradient-text">HACKATHON</span><br />
            <span className={styles.heroYear}>2K26</span>
          </h1>

          <p className={`${styles.heroSubtext} animate-fadeInUp`} style={{ animationDelay: '0.3s' }}>
            48 Hours. Unlimited Potential. One Stage.
          </p>

          <div className={`${styles.heroDates} animate-fadeInUp`} style={{ animationDelay: '0.4s' }}>
            <span className={styles.dateChip}>📅 July 31 – August 1, 2026</span>
            <span className={styles.dateChip}>📍 GIIS Smart Campus, Singapore</span>
            <span className={styles.dateChip}>👥 ~400 Participants</span>
          </div>

          <div className={`${styles.heroButtons} animate-fadeInUp`} style={{ animationDelay: '0.5s' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Register Your Team →
            </Link>
            <Link href="/#about" className="btn btn-outline btn-lg">
              Learn More
            </Link>
          </div>
        </div>

        {/* Countdown */}
        <div className={`${styles.countdownWrapper} animate-fadeInUp`} style={{ animationDelay: '0.7s' }}>
          <p className="section-label" style={{ justifyContent: 'center' }}>Countdown to Hackathon</p>
          <CountdownTimer targetDate="2026-07-31T08:00:00+08:00" />
        </div>

        <div className={styles.scrollHint}>
          <div className={styles.scrollDot} />
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section className="section-sm">
        <div className="container">
          <div className={styles.statsGrid}>
            {[
              { number: '400+', label: 'Participants', icon: '👥' },
              { number: '48H', label: 'Build Time', icon: '⏱' },
              { number: '4', label: 'Team Size Max', icon: '🤝' },
              { number: '∞', label: 'Possibilities', icon: '🚀' },
            ].map((stat) => (
              <div key={stat.label} className={`card card-hover ${styles.statCard} reveal`}>
                <div className={styles.statIcon}>{stat.icon}</div>
                <div className={styles.statNumber}>{stat.number}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────────── */}
      <section className="section" id="about">
        <div className="container">
          <div className={styles.aboutGrid}>
            <div className={styles.aboutText}>
              <p className="section-label">About the Event</p>
              <h2>What is<br /><span className="gradient-text">GIIS Hackathon?</span></h2>
              <p>
                GIIS Hackathon 2K26 is the flagship innovation event hosted by the GIIS Tech Club.
                Over 48 intense hours, participants collaborate in teams to ideate, design, and build
                tech solutions to real-world problems.
              </p>
              <p>
                Whether you{"'"}re a coder, designer, or problem-solver — there{"'"}s a place for you here.
                Compete, create, and connect with the brightest minds at GIIS.
              </p>
              <div className={styles.aboutHighlights}>
                {[
                  { icon: '💡', text: 'Real-world problem statements' },
                  { icon: '🏆', text: 'Exciting prizes across tracks' },
                  { icon: '🧑‍💻', text: 'Mentorship from industry experts' },
                  { icon: '🎤', text: 'Demo day pitches & judging' },
                ].map((h) => (
                  <div key={h.text} className={styles.highlightItem}>
                    <span>{h.icon}</span>
                    <span>{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.aboutVisual}>
              <div className={styles.glowOrb} />
              <div className={`card ${styles.aboutCard}`}>
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Date</span>
                  <span>July 31 – August 1, 2026</span>
                </div>
                <div className={styles.aboutCardDivider} />
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Venue</span>
                  <span>GIIS Smart Campus, Singapore</span>
                </div>
                <div className={styles.aboutCardDivider} />
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Team Size</span>
                  <span>2 – 4 Members</span>
                </div>
                <div className={styles.aboutCardDivider} />
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Registration</span>
                  <span className="text-accent">Open Now →</span>
                </div>
                <div className={styles.aboutCardDivider} />
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Problem Statements</span>
                  <span>Released closer to the event</span>
                </div>
                <div className={styles.aboutCardDivider} />
                <div className={styles.aboutCardItem}>
                  <span className={styles.aboutCardLabel}>Prizes</span>
                  <span>Coming soon 🔥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ─────────────────────────────────────────── */}
      <section className="section" id="schedule">
        <div className="container">
          <p className="section-label">Event Schedule</p>
          <h2>The <span className="gradient-text">48-Hour</span> Journey</h2>

          <div className={styles.scheduleGrid}>
            {/* Day 1 */}
            <div>
              <h3 className={styles.dayHeading}>
                <span className="badge badge-teal">Day 1</span>
                July 31, 2026
              </h3>
              <div className={styles.timeline}>
                {[
                  { time: '08:00', event: 'Registration & Check-In', icon: '🎫', type: 'start' },
                  { time: '09:00', event: 'Opening Ceremony & Problem Release', icon: '🎤', type: '' },
                  { time: '10:00', event: 'Hacking Begins!', icon: '💻', type: 'highlight' },
                  { time: '13:00', event: 'Lunch Break', icon: '🍱', type: '' },
                  { time: '15:00', event: 'Mentor Sessions Round 1', icon: '🧑‍💼', type: '' },
                  { time: '19:00', event: 'Dinner Break', icon: '🍽️', type: '' },
                  { time: '22:00', event: 'Late Night Snacks & Music', icon: '🎵', type: '' },
                ].map((item) => (
                  <div key={item.time} className={`${styles.timelineItem} ${item.type === 'highlight' ? styles.timelineHighlight : ''}`}>
                    <div className={styles.timelineTime}>{item.time}</div>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineIcon}>{item.icon}</span>
                      <span>{item.event}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day 2 */}
            <div>
              <h3 className={styles.dayHeading}>
                <span className="badge badge-cyan">Day 2</span>
                August 1, 2026
              </h3>
              <div className={styles.timeline}>
                {[
                  { time: '08:00', event: 'Morning & Breakfast', icon: '☀️', type: '' },
                  { time: '10:00', event: 'Mentor Sessions Round 2', icon: '🧑‍💼', type: '' },
                  { time: '12:00', event: 'Submissions Close', icon: '🔒', type: 'highlight' },
                  { time: '13:00', event: 'Lunch & Project Judging Begins', icon: '⚖️', type: '' },
                  { time: '15:00', event: 'Final Presentations / Demo Day', icon: '🎯', type: 'highlight' },
                  { time: '17:00', event: 'Awards Ceremony', icon: '🏆', type: 'highlight' },
                  { time: '18:00', event: 'Closing & Networking', icon: '🎉', type: '' },
                ].map((item) => (
                  <div key={item.time} className={`${styles.timelineItem} ${item.type === 'highlight' ? styles.timelineHighlight : ''}`}>
                    <div className={styles.timelineTime}>{item.time}</div>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineIcon}>{item.icon}</span>
                      <span>{item.event}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRACKS ───────────────────────────────────────────── */}
      <section className="section" id="tracks">
        <div className="container">
          <p className="section-label">Competition Tracks</p>
          <h2>Choose Your <span className="gradient-text">Track</span></h2>
          <p style={{ marginBottom: 'var(--space-6)', maxWidth: '600px' }}>
            Problem statements and detailed tracks will be released closer to the event date.
            Stay tuned and start preparing your skills!
          </p>

          <div className="grid-3">
            {[
              {
                icon: '🌍',
                title: 'Track 1',
                subtitle: 'Coming Soon',
                desc: 'Problem statement to be released closer to the event. Start sharpening your skills!',
                color: 'var(--color-accent)',
              },
              {
                icon: '🏥',
                title: 'Track 2',
                subtitle: 'Coming Soon',
                desc: 'Problem statement to be released closer to the event. Think big, build bigger.',
                color: 'var(--color-accent-3)',
              },
              {
                icon: '📚',
                title: 'Track 3',
                subtitle: 'Coming Soon',
                desc: 'Problem statement to be released closer to the event. Innovation awaits.',
                color: 'var(--color-accent-2)',
              },
            ].map((track) => (
              <div key={track.title} className={`card card-hover reveal ${styles.trackCard}`}>
                <div className={styles.trackIcon} style={{ color: track.color }}>{track.icon}</div>
                <h3 className={styles.trackTitle}>{track.title}</h3>
                <span className="badge badge-teal" style={{ marginBottom: '12px' }}>{track.subtitle}</span>
                <p style={{ fontSize: '0.95rem' }}>{track.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="section" id="how" style={{ paddingBottom: 0 }}>
        <div className="container">
          <p className="section-label">// How It Works</p>
          <h2>Your Path to <span className="gradient-text">Victory</span></h2>

          <div className={styles.pathsSection}>
            <p className={styles.pathsLead}>Choose one of 3 paths:</p>
            <div className={styles.pathsGrid}>
              <div className={`card ${styles.pathCard}`}>
                <div className={styles.pathIcon}>🎮</div>
                <h3 className={styles.pathTitle}>Game Dev</h3>
                <p className={styles.pathDesc}>Build immersive worlds. Create a game that tells a story or challenges the mind using any engine of your choice.</p>
              </div>
              <div className={`card ${styles.pathCard}`}>
                <div className={styles.pathIcon}>📱</div>
                <h3 className={styles.pathTitle}>App Dev</h3>
                <p className={styles.pathDesc}>Solve daily problems. Design and develop a mobile application that makes life easier or more connected.</p>
              </div>
              <div className={`card ${styles.pathCard}`}>
                <div className={styles.pathIcon}>🌐</div>
                <h3 className={styles.pathTitle}>Web Dev</h3>
                <p className={styles.pathDesc}>Engineer the future of the web. Create a powerful web platform or tool that scales across the internet.</p>
              </div>
            </div>
          </div>

          <div className={styles.howGrid}>
            {[
              { step: '01', title: 'Register', desc: 'Sign up your team of 2–4 members. Each member gets a unique QR code for event access.', icon: '📝' },
              { step: '02', title: 'Build', desc: 'Receive the problem statement and start hacking. 48 hours of coding, designing, and creating.', icon: '🔨' },
              { step: '03', title: 'Submit', desc: 'Submit your project via our portal — GitHub repo, drive links, and a description.', icon: '🚀' },
              { step: '04', title: 'Present', desc: 'Demo your project to our panel of judges. The best teams walk away with glory and prizes.', icon: '🏆' },
            ].map((step, i) => (
              <div key={step.step} className={`reveal ${styles.howStep}`} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={styles.howStepNum}>{step.step}</div>
                <div className={styles.howIcon}>{step.icon}</div>
                <h3 className={styles.howTitle}>{step.title}</h3>
                <p style={{ fontSize: '0.95rem' }}>{step.desc}</p>
                {i < 3 && <div className={styles.howArrow}>→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="container">
          <p className="section-label">// FAQ</p>
          <h2>Got <span className="gradient-text">Questions?</span></h2>

          <div className={styles.faqGrid}>
            {[
              {
                q: 'Who can participate?',
                a: 'All GIIS students are welcome to participate. Teams must register together as a group of 2–4 members.',
              },
              {
                q: 'Do I need to know how to code?',
                a: 'Teams can have members with different skills — coding, design, research, and presentation skills all contribute to a winning project.',
              },
              {
                q: 'What do I need to bring?',
                a: 'Your laptop, charger, your ideas, and your team! All participants must carry their QR code for check-in and food collection.',
              },
              {
                q: 'What can we build?',
                a: 'You can build a web app, mobile app, hardware prototype, or any digital solution. The problem statements will guide the direction.',
              },
              {
                q: 'When are problem statements released?',
                a: 'Problem statements will be released at the opening ceremony on July 31. Keep the details confidential until then!',
              },
              {
                q: 'Is food provided?',
                a: 'Yes! Meals and snacks are provided throughout the hackathon. Use your QR code for food collection.',
              },
            ].map((faq) => (
              <div key={faq.q} className={`card reveal ${styles.faqCard}`}>
                <h4 className={styles.faqQ}>{faq.q}</h4>
                <p className={styles.faqA}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className={`section ${styles.ctaSection}`}>
        <div className="container">
          <div className={`card ${styles.ctaCard}`}>
            <div className={styles.ctaGlow} />
            <p className="section-label" style={{ justifyContent: 'center' }}>Ready to hack?</p>
            <h2 className={styles.ctaHeading}>
              Join the <span className="gradient-text">Revolution</span>
            </h2>
            <p className={styles.ctaSubtext}>
              Register your team now before spots fill up. Limited to ~400 participants.
            </p>
            <Link href="/register" className="btn btn-primary btn-lg animate-pulse-glow">
              🚀 Register Your Team
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <div>
              <div className={styles.footerLogo}>GIIS<span>HACK</span> 2K26</div>
              <p className={styles.footerTagline}>Organized by GIIS Tech Club</p>
            </div>
            <div className={styles.footerLinks}>
              <Link href="https://giistechclub.com" target="_blank">Tech Club Website</Link>
              <Link href="mailto:techclub@giis.edu.sg">Contact Us</Link>
              <Link href="/admin">Admin</Link>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© 2026 GIIS Tech Club. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
