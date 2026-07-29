import Link from 'next/link'
import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'

const CountdownTimer = nextDynamic(() => import('@/components/CountdownTimer'), { ssr: false })
const HeroCanvas = nextDynamic(() => import('@/components/HeroCanvas'), { ssr: false })

export const dynamic = 'force-dynamic'

// Track only applies to Seniors (Grades 9-12) — Juniors have no track and
// can build whatever they want.
const TRACKS = [
  { tag: 'Track 01', name: 'App/Web Dev', tool: 'App Inventor, Kodular, Any Framework, or Vanilla', desc: 'Build a mobile app or a web app/site. MIT App Inventor, Kodular, any framework, or plain HTML/CSS/JS — external and open-source libraries are fair game; AI assistance permitted but must be disclosed.' },
  { tag: 'Track 02', name: 'Game Dev', tool: 'Scratch Only', desc: 'Build a game in Scratch. Scratch extensions only — no external code libraries.' },
]

// Kept secret until the opening ceremony — only the count is public.
const PROBLEM_COUNT = 3

const CRITERIA = [
  { name: 'Relevance to Challenge Topic', max: 30 },
  { name: 'Creativity & Originality', max: 25 },
  { name: 'Functionality', max: 25 },
  { name: 'User Experience / Playability', max: 20 },
  { name: 'Presentation & Demo', max: 20 },
  { name: 'Code / Design Quality', max: 15 },
  { name: 'Completeness', max: 15 },
]

// Kept secret until the event — only the count is public.
const SIDE_QUEST_COUNT = 5

const STEPS = [
  { n: '01', title: 'Register', desc: 'Sign up your team of 2–4. Each member gets a unique QR code for event access.' },
  { n: '02', title: 'Build', desc: 'Pick a problem statement and start hacking. 48 hours of coding, designing, creating.' },
  { n: '03', title: 'Submit', desc: 'Submit your project through the portal — GitHub repo, drive link, and a description.' },
  { n: '04', title: 'Present', desc: 'Demo to the OT judges. Top teams on each leaderboard take home the glory.' },
]

const SCHEDULE = {
  day1: [
    { t: '08:00', e: 'Registration & Check-In' },
    { t: '09:00', e: 'Opening Ceremony & Problem Release', hot: true },
    { t: '10:00', e: 'Hacking Begins', hot: true },
    { t: '13:00', e: 'Lunch Break' },
    { t: '15:00', e: 'Mentor Sessions — Round 1' },
    { t: '19:00', e: 'Dinner Break' },
    { t: '22:00', e: 'Late Night Snacks & Music' },
  ],
  day2: [
    { t: '08:00', e: 'Morning & Breakfast' },
    { t: '10:00', e: 'Mentor Sessions — Round 2' },
    { t: '12:00', e: 'Submissions Close', hot: true },
    { t: '13:00', e: 'Judging Begins' },
    { t: '15:00', e: 'Final Presentations / Demo Day', hot: true },
    { t: '17:00', e: 'Awards Ceremony', hot: true },
    { t: '18:00', e: 'Closing & Networking' },
  ],
}

const FAQS = [
  { q: 'Who can participate?', a: 'All GIIS students are welcome. Teams register together as a group of 2–4 members.' },
  { q: 'Do I need to know how to code?', a: 'Teams can mix skills — coding, design, research, and presentation all contribute to a winning project.' },
  { q: 'What do I need to bring?', a: 'Your laptop, charger, ideas, and your team. Carry your QR code for check-in and food collection.' },
  { q: 'What can we build?', a: 'Seniors (Grades 9–12) pick a track — App/Web Dev or Game Dev (Scratch only) — and tackle one of the three problem statements above. Juniors (Grades 6–8) have no track restriction and can build anything.' },
  { q: 'How is judging done?', a: 'Each project is scored by multiple OT judges across the 7 criteria above, then averaged into a live leaderboard. Side Quests add extra points on top.' },
  { q: 'Is food provided?', a: 'Yes — meals and snacks throughout the event. Use your QR code for food collection.' },
]

const eyebrow = 'mb-3 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand'
const h2 = 'font-display text-3xl font-bold text-ink sm:text-4xl [text-wrap:balance]'
const card = 'rounded-card border border-line bg-panel/70 p-6'

export default function HomePage({ searchParams }: { searchParams?: { code?: string } }) {
  // Supabase sends password-reset links to the site root (/?code=xxx).
  // Forward to the real callback handler.
  if (searchParams?.code) {
    redirect(`/auth/callback?code=${searchParams.code}&next=/auth/reset-password`)
  }

  return (
    <div className="min-h-screen bg-base font-body text-ink">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-28 text-center">
        <HeroCanvas />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: 'radial-gradient(80% 50% at 50% 0%, rgba(47,230,200,0.08), transparent 60%)' }}
        />
        <div className="relative z-10 flex w-full max-w-6xl flex-col items-center">
          <span className="mb-8 rounded-full border border-line bg-panel/60 px-5 py-2 font-mono text-sm uppercase tracking-[0.2em] text-brand backdrop-blur">
            GIIS Tech Club Presents
          </span>
          <h1 className="font-display text-[2.85rem] font-black leading-[0.92] tracking-tight text-ink sm:text-[5.7rem] lg:text-[8.55rem]">
            GIIS<br />HACKATHON<br />
            <span className="bg-gradient-to-b from-brand to-brand-deep bg-clip-text text-transparent">2K26</span>
          </h1>
          <p className="mt-8 font-mono text-base uppercase tracking-[0.3em] text-ink-sub sm:text-xl">
            48 Hours · Unlimited Potential · One Stage
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {['July 31 – August 1, 2026', 'GIIS Smart Campus, Singapore'].map((c) => (
              <span key={c} className="rounded-full border border-line bg-panel/50 px-5 py-2 font-mono text-sm tracking-wide text-ink-sub">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-lg bg-gradient-to-br from-brand to-brand-blue px-10 py-5 font-mono text-base font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90">
              Register Your Team →
            </Link>
            <Link href="/leaderboard" className="rounded-lg border border-line px-10 py-5 font-mono text-base font-bold uppercase tracking-[0.14em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5">
              Live Leaderboard
            </Link>
          </div>
          <div className="mt-16 w-full">
            <p className="mb-5 font-mono text-sm uppercase tracking-[0.24em] text-ink-dim">Countdown to Hackathon</p>
            <CountdownTimer targetDate="2026-07-31T14:30:00+08:00" />
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { n: '48H', l: 'Build Time' },
            { n: '4', l: 'Leaderboards' },
            { n: '2', l: 'Senior Tracks' },
            { n: '150', l: 'Max Points' },
          ].map((s) => (
            <div key={s.l} className="rounded-card border border-line bg-panel/70 px-4 py-6 text-center">
              <div className="font-display text-3xl font-black text-brand sm:text-4xl">{s.n}</div>
              <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink-dim">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────────── */}
      <section id="about" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className={eyebrow}>// About the Event</p>
            <h2 className={h2}>What is GIIS Hackathon?</h2>
            <p className="mt-4 leading-relaxed text-ink-sub">
              The flagship innovation event of the GIIS Tech Club. Over 48 intense hours, teams
              ideate, design, and build real tech solutions to real-world problems.
            </p>
            <p className="mt-3 leading-relaxed text-ink-sub">
              Coder, designer, or problem-solver — there&apos;s a place for you. Compete, create, and
              connect with the sharpest minds at GIIS.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {['Real-world problem statements', 'Points-based judging across 4 leaderboards', 'Side Quests for bonus points', 'Demo day pitches & awards'].map((t) => (
                <div key={t} className="flex items-center gap-3 rounded-lg border border-line bg-panel/50 px-4 py-2.5 text-sm text-ink-sub">
                  <span className="text-brand">→</span>{t}
                </div>
              ))}
            </div>
          </div>
          <div className={card}>
            {[
              ['Date', 'July 31 – August 1, 2026'],
              ['Venue', 'GIIS Smart Campus, Singapore'],
              ['Team Size', '2 – 4 Members'],
              ['Registration', 'Open Now →'],
              ['Problem Statements', 'Released at the opening ceremony'],
            ].map(([k, v], i, arr) => (
              <div key={k} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? 'border-b border-line' : ''}`}>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brand">{k}</span>
                <span className="text-sm font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ─────────────────────────────────────────── */}
      <section id="schedule" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// Event Schedule</p>
        <h2 className={h2}>The 48-Hour Journey</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {([['Day 1 · July 31', SCHEDULE.day1], ['Day 2 · August 1', SCHEDULE.day2]] as const).map(([label, items]) => (
            <div key={label}>
              <h3 className="mb-4 font-display text-lg font-bold text-brand">{label}</h3>
              <div className="flex flex-col">
                {items.map((it) => (
                  <div key={it.t} className="flex items-center gap-4 border-b border-line-soft py-3 last:border-0">
                    <span className="w-14 shrink-0 font-mono text-sm text-ink-dim [font-variant-numeric:tabular-nums]">{it.t}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${it.hot ? 'bg-brand shadow-glow' : 'bg-line'}`} />
                    <span className={`text-sm ${it.hot ? 'font-medium text-brand' : 'text-ink-sub'}`}>{it.e}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRACKS ───────────────────────────────────────────── */}
      <section id="tracks" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// Seniors Only</p>
        <h2 className={h2}>Choose Your Track</h2>
        <p className="mt-3 max-w-xl text-ink-sub">
          <strong className="text-ink">Seniors</strong> (Grades 9–12) pick one of 2 tracks below.{' '}
          <strong className="text-ink">Juniors</strong> (Grades 6–8) skip this entirely — no track, build whatever you want.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {TRACKS.map((t) => (
            <div key={t.name} className={`${card} transition-colors hover:border-brand/40`}>
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ink-dim">{t.tag}</div>
              <h3 className="mt-2 font-display text-xl font-bold text-ink">{t.name}</h3>
              <span className="mt-2 inline-block rounded-full bg-brand/10 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-brand">{t.tool}</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-sub">{t.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-card border border-brand/25 bg-brand/[0.06] px-5 py-4 text-sm text-ink-sub">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <span>
            Seniors compete on 2 leaderboards — <strong className="text-ink">App/Web Dev</strong> and{' '}
            <strong className="text-ink">Game Dev</strong> — by track. Juniors rank together on one combined leaderboard,
            no track needed. Category is decided by the <strong className="text-ink">team&apos;s oldest member</strong>. See the full{' '}
            <Link href="/leaderboard" className="text-brand underline">Leaderboard →</Link>
          </span>
        </div>
      </section>

      {/* ── PROBLEM STATEMENTS ───────────────────────────────── */}
      <section id="problems" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// Pick a Challenge</p>
        <h2 className={h2}>Problem Statements</h2>
        <p className="mt-3 max-w-xl text-ink-sub">
          Every team picks one of {PROBLEM_COUNT} challenges — kept secret until the opening ceremony. Any track can tackle any challenge.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: PROBLEM_COUNT }).map((_, i) => (
            <div key={i} className={`${card} flex flex-col items-center gap-3 text-center transition-colors hover:border-brand/40`}>
              <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-brand">Challenge {String(i + 1).padStart(2, '0')}</div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line font-display text-2xl text-ink-dim">?</div>
              <p className="text-sm leading-relaxed text-ink-dim">Revealed at the Opening Ceremony</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── JUDGING CRITERIA ─────────────────────────────────── */}
      <section id="judging" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// How You&apos;re Scored</p>
        <h2 className={h2}>Judging Criteria</h2>
        <p className="mt-3 max-w-xl text-ink-sub">
          Scored by multiple OT judges across these categories, then averaged — 150 points total.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CRITERIA.map((c) => (
            <div key={c.name} className="flex flex-col justify-between rounded-card border border-line bg-panel/70 p-4">
              <div className="text-sm font-medium text-ink">{c.name}</div>
              <span className="mt-3 inline-block w-fit rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wide text-brand">Max {c.max} pts</span>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-card border border-dashed border-line p-4 text-center">
            <div className="font-display text-2xl font-black text-brand-blue">150</div>
            <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-wide text-ink-dim">Points Total</div>
          </div>
        </div>
      </section>

      {/* ── SIDE QUESTS ──────────────────────────────────────── */}
      <section id="side-quests" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// Extra Credit</p>
        <h2 className={h2}>Side Quests</h2>
        <p className="mt-3 max-w-xl text-ink-sub">
          {SIDE_QUEST_COUNT} bonus challenges, released throughout the event — solve one for extra points on top of your project score.
          What they are stays secret until the day of.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SIDE_QUEST_COUNT }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-card border border-line bg-panel/70 px-5 py-4">
              <span className="font-medium text-ink-dim">Side Quest {i + 1}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line font-display text-sm text-ink-dim">?</span>
            </div>
          ))}
          <Link href="/register" className="flex items-center justify-center rounded-card border border-dashed border-brand/40 px-5 py-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-brand transition-colors hover:bg-brand/5">
            Register to play →
          </Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// How It Works</p>
        <h2 className={h2}>Your Path to Victory</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className={card}>
              <span className="inline-block rounded-full bg-brand px-3 py-1 font-mono text-[0.62rem] font-bold tracking-[0.14em] text-base">{s.n}</span>
              <h3 className="mt-3 font-display text-base font-bold text-brand">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 mx-auto max-w-6xl px-4 py-20">
        <p className={eyebrow}>// FAQ</p>
        <h2 className={h2}>Got Questions?</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q} className={card}>
              <h3 className="font-display text-sm font-bold text-brand">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 py-20">
        <div className="relative overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.12] via-panel to-panel p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative">
            <p className={`${eyebrow} inline-block`}>// Ready to hack?</p>
            <h2 className="font-display text-3xl font-black text-ink sm:text-4xl">Join us Today!</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-sub">
              Register for the Hackathon Today!
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="rounded-lg bg-gradient-to-br from-brand to-brand-blue px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-base transition-opacity hover:opacity-90">
                Register Your Team →
              </Link>
              <Link href="/leaderboard" className="rounded-lg border border-line px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-brand transition-colors hover:border-brand/60 hover:bg-brand/5">
                View Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-line bg-base/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 text-center">
          <div className="flex flex-col items-center gap-2">
            <img src="/logo.png" alt="GIIS Hackathon" width={56} height={56} className="h-14 w-14 object-contain" />
            <div className="font-display text-lg font-black tracking-wide text-ink">GIIS Hackathon <span className="text-brand">2K26</span></div>
            <p className="text-sm text-ink-dim">Organized by GIIS Tech Club</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { href: 'https://giistechclub.com', label: 'Tech Club' },
              { href: 'mailto:techclub@giis.edu.sg', label: 'Contact' },
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/admin', label: 'Admin' },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="rounded-full border border-line px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink-sub transition-colors hover:border-brand/50 hover:text-brand">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="border-t border-line pt-4 font-mono text-[0.62rem] text-ink-dim">© 2026 GIIS Tech Club. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
