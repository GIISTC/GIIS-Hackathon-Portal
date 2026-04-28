# 🚀 GIIS Hackathon 2K26 — Portal

> The official event management portal for **GIIS Hackathon 2K26**, organized by the GIIS Tech Club.  
> A full-stack Next.js application with participant registration, QR-based check-in, project submission, and a Gavel-style judging system — all powered by Supabase.

---

## ✨ Features at a Glance

| Feature | Description |
|---|---|
| 🏠 **Landing Page** | Animated hero, live countdown timer, event schedule, tracks, FAQ |
| 📝 **Team Registration** | Create or join a team with unique team codes; per-member password auth |
| 🔑 **Email + Password Auth** | Supabase Auth with secure login, forgot-password reset flow via email |
| 🎫 **QR Code System** | Each participant gets a unique UUID-based QR token for check-in |
| 📊 **Participant Dashboard** | View team info, QR code, project submission status |
| 🚀 **Project Submission** | Submit GitHub repo, Drive link, demo URL, and description |
| ⚖️ **Judging System** | Gavel-style adaptive comparison judging with live leaderboard |
| 🛡️ **Admin Panel** | Full team/participant management, event settings, check-in scanner |
| 🔒 **Role-Based Access** | Middleware guards routes for admins (judges) vs. participants |
| 📱 **Responsive Design** | Mobile-first, works seamlessly across all screen sizes |

---

## 🗂️ Project Structure

```
hackathon-portal/
├── app/
│   ├── page.tsx                  # Landing page (hero, schedule, FAQ, CTA)
│   ├── login/                    # Email + password login with forgot-password flow
│   ├── register/                 # Team create / join registration
│   ├── dashboard/
│   │   ├── page.tsx              # Participant dashboard (team info, QR code)
│   │   └── submit/              # Project submission form
│   ├── admin/
│   │   ├── page.tsx              # Admin overview (teams, participants, stats)
│   │   ├── checkin/             # QR code scanner for event check-in
│   │   ├── judging/             # Judging leaderboard & score overview
│   │   ├── submissions/         # All project submissions view
│   │   └── teams/               # Team management
│   ├── auth/
│   │   ├── callback/            # Supabase OAuth / magic link callback handler
│   │   └── reset-password/      # Password reset page (from email link)
│   └── api/
│       ├── admin/
│       │   ├── settings/        # GET/POST event settings (name, dates, etc.)
│       │   └── judging-stats/   # Aggregated scoring statistics
│       └── judge/
│           ├── pair/            # Gavel: fetch next pair of projects to compare
│           └── vote/            # Gavel: submit a comparison vote
├── components/
│   ├── Navbar.tsx               # Responsive navigation bar
│   ├── AdminNav.tsx             # Admin-specific sidebar navigation
│   ├── CountdownTimer.tsx       # Live countdown to hackathon start
│   └── HeroCanvas.tsx           # Animated WebGL/canvas hero background
├── lib/
│   ├── supabase/                # Supabase client (browser + server + admin)
│   ├── judging/                 # Gavel algorithm logic (adaptive ranking)
│   └── types.ts                 # Shared TypeScript interfaces
├── middleware.ts                 # Route protection & role-based redirects
└── supabase_schema.sql          # Full database schema (run once to set up DB)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router) |
| **Language** | TypeScript |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + Auth) |
| **Styling** | Vanilla CSS (CSS Modules) — no Tailwind |
| **QR Codes** | `qrcode` + `html5-qrcode` |
| **Hosting** | Vercel (recommended) |

---

## 🗃️ Database Schema

The database (PostgreSQL via Supabase) includes the following core tables:

### `teams`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `team_name` | `text` | Unique team name |
| `team_code` | `text` | 6-char invite code for joining |
| `project_name` | `text` | Submitted project name |
| `track` | `text` | Competition track selected |
| `created_at` | `timestamptz` | Registration timestamp |

### `participants`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Matches `auth.users.id` |
| `team_id` | `uuid` | Foreign key → `teams` |
| `full_name` | `text` | Full name |
| `email` | `text` | Login email |
| `grade` | `text` | School grade (6–12) |
| `is_team_leader` | `bool` | Leader flag |
| `qr_token` | `uuid` | Unique QR identifier |
| `checked_in` | `bool` | Event check-in status |
| `checked_in_at` | `timestamptz` | Check-in timestamp |

### `submissions`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `team_id` | `uuid` | Foreign key → `teams` |
| `project_name` | `text` | Project title |
| `description` | `text` | Project description |
| `github_url` | `text` | GitHub repository link |
| `drive_url` | `text` | Google Drive link (optional) |
| `demo_url` | `text` | Live demo URL (optional) |
| `submitted_at` | `timestamptz` | First submission time |
| `updated_at` | `timestamptz` | Last edit time |

### `judges`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Matches `auth.users.id` |
| `name` | `text` | Judge display name |
| `email` | `text` | Judge email |
| `role` | `text` | `core`, `academics`, or `ot` |

### `scores`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `team_id` | `uuid` | Foreign key → `teams` |
| `judge_id` | `uuid` | Foreign key → `judges` |
| `innovation` | `int` | Score 1–10 |
| `technical` | `int` | Score 1–10 |
| `design` | `int` | Score 1–10 |
| `impact` | `int` | Score 1–10 |
| `presentation` | `int` | Score 1–10 |
| `notes` | `text` | Optional judge notes |

> Run `supabase_schema.sql` in the Supabase SQL editor to create all tables and RLS policies.

---

## 🔐 Authentication & Roles

- **Participants** register with email + self-chosen password via Supabase Auth.
- **Team Leaders** create a team; members join using a 6-character **Team Code**.
- **Forgot Password** flow sends a reset email via Supabase; users reset on `/auth/reset-password`.
- **Judges / Admins** are users who also exist in the `judges` table. The middleware automatically redirects them to `/admin` after login.
- **Route Protection** (via `middleware.ts`):
  - `/admin/*` → requires login AND judge record in DB
  - `/dashboard/*` → requires login
  - `/login`, `/register` → redirects logged-in users to dashboard

---

## ⚙️ Environment Variables

Create a `.env.local` file at the project root (never commit this):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side API routes (admin operations). It is never exposed to the browser.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com/) project

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/GIIS-Hackathon-Portal.git
cd GIIS-Hackathon-Portal

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL and keys

# 4. Set up the database
# Open your Supabase SQL editor and run: supabase_schema.sql

# 5. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## 📋 Key Pages & Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with event info |
| `/register` | Public | Team creation & member join form |
| `/login` | Public | Email + password sign-in |
| `/auth/reset-password` | Public | Password reset (via email link) |
| `/dashboard` | Participants | QR code, team info, submission status |
| `/dashboard/submit` | Participants | Project submission form |
| `/admin` | Judges only | Admin overview dashboard |
| `/admin/checkin` | Judges only | QR code scanner for check-in |
| `/admin/judging` | Judges only | Gavel judging & leaderboard |
| `/admin/submissions` | Judges only | View all project submissions |
| `/admin/teams` | Judges only | Team & participant management |

---

## ⚖️ Judging System (Gavel-style)

The judging system uses **adaptive comparison** (inspired by [Gavel](https://github.com/anishathalye/gavel)):

1. Judges are shown **two projects at a time** and pick which is better.
2. The algorithm tracks win/loss comparisons to build a ranking.
3. A live **leaderboard** aggregates scores across all judges with per-category breakdowns (Innovation, Technical, Design, Impact, Presentation).
4. Admin can view overall stats via the `/api/admin/judging-stats` endpoint.

---

## 📱 QR Code Check-In

- Each registered participant receives a **unique QR token** (UUID) stored in the database.
- Their QR code is displayed in the `/dashboard` page.
- Event admins use the `/admin/checkin` page to **scan QR codes** in real-time.
- Scan results are stored with a timestamp (`checked_in_at`).

---

## 🎨 Design System

The portal uses a custom **cyberpunk/dark-tech** design language:

- **Colors**: Deep navy backgrounds, cyan-teal (`#00D4B4`) and purple (`#7C3AED`) accents
- **Typography**: `Orbitron` (headings) + `Rajdhani` (body) from Google Fonts
- **Animations**: Glitch effect on hero, fade-in reveals on scroll, pulse glow on CTAs
- **Components**: Cards with glassmorphism, gradient text, animated canvas background

---

## 📦 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## 🏫 About

**GIIS Hackathon 2K26** is the flagship innovation event by the **GIIS Tech Club** at GIIS Smart Campus, Singapore.

- 📅 **Date**: July 31 – August 1, 2026
- 📍 **Venue**: GIIS Smart Campus, Singapore
- 👥 **Participants**: ~400 students
- ⏱ **Duration**: 48 hours
- 🏆 **Tracks**: Game Dev · App Dev · Web Dev

---

## 📄 License

This project is private and owned by the **GIIS Tech Club**.  
All rights reserved © 2026 GIIS Tech Club.
