-- ================================================================
-- GIIS HACKATHON 2K26 — COMPLETE DATABASE REBUILD
-- Run this entire script in the Supabase SQL Editor.
-- WARNING: This drops and recreates all tables. All existing
-- data (teams, participants, submissions) will be deleted.
-- ================================================================

-- ----------------------------------------------------------------
-- STEP 1: Drop everything cleanly (order matters due to FK deps)
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS matchups          CASCADE;
DROP TABLE IF EXISTS scores            CASCADE;
DROP TABLE IF EXISTS submissions       CASCADE;
DROP TABLE IF EXISTS system_settings   CASCADE;
DROP TABLE IF EXISTS participants      CASCADE;
DROP TABLE IF EXISTS judges            CASCADE;
DROP TABLE IF EXISTS teams             CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_my_team_id()          CASCADE;
DROP FUNCTION IF EXISTS check_existing_emails(text[]) CASCADE;


-- ----------------------------------------------------------------
-- STEP 2: Create Tables
-- ----------------------------------------------------------------

-- teams
CREATE TABLE teams (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name    text        NOT NULL UNIQUE,
  team_code    text        NOT NULL UNIQUE,
  created_at   timestamptz DEFAULT now()
);

-- judges  (must exist before participants references it)
CREATE TABLE judges (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  role       text NOT NULL DEFAULT 'judge',
  created_at timestamptz DEFAULT now()
);

-- participants
CREATE TABLE participants (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id        uuid        REFERENCES teams(id) ON DELETE SET NULL,
  full_name      text        NOT NULL,
  email          text        NOT NULL UNIQUE,
  grade          text        NOT NULL,
  is_team_leader boolean     DEFAULT false,
  qr_token       text        NOT NULL UNIQUE,
  checked_in     boolean     DEFAULT false,
  checked_in_at  timestamptz,
  created_at     timestamptz DEFAULT now()
);

-- submissions
CREATE TABLE submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid        UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  project_name text        NOT NULL,
  description  text        NOT NULL,
  github_url   text        NOT NULL,
  drive_url    text,
  demo_url     text,
  elo_rating   float       DEFAULT 1000.0,
  matches_played int       DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- scores (legacy rubric-based scoring — kept for compatibility)
CREATE TABLE scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid REFERENCES teams(id) ON DELETE CASCADE,
  judge_id     uuid REFERENCES judges(id) ON DELETE CASCADE,
  innovation   int NOT NULL CHECK (innovation BETWEEN 1 AND 10),
  technical    int NOT NULL CHECK (technical BETWEEN 1 AND 10),
  design       int NOT NULL CHECK (design BETWEEN 1 AND 10),
  impact       int NOT NULL CHECK (impact BETWEEN 1 AND 10),
  presentation int NOT NULL CHECK (presentation BETWEEN 1 AND 10),
  notes        text,
  scored_at    timestamptz DEFAULT now(),
  UNIQUE(team_id, judge_id)
);

-- matchups (Gavel pairwise comparison log)
CREATE TABLE matchups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id   uuid REFERENCES judges(id) ON DELETE CASCADE,
  winner_id  uuid REFERENCES submissions(id) ON DELETE CASCADE,
  loser_id   uuid REFERENCES submissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- system_settings (admin toggles)
CREATE TABLE system_settings (
  key        text    PRIMARY KEY,
  value      boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);


-- ----------------------------------------------------------------
-- STEP 3: Helper Functions
-- ----------------------------------------------------------------

-- Returns the team_id of the currently logged-in participant
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT team_id FROM participants WHERE id = auth.uid();
$$;

-- Checks if any of the given emails are already registered
CREATE OR REPLACE FUNCTION check_existing_emails(emails_to_check text[])
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN ARRAY(
    SELECT email FROM participants WHERE email = ANY(emails_to_check)
  );
END;
$$;


-- ----------------------------------------------------------------
-- STEP 4: Enable Row Level Security on every table
-- ----------------------------------------------------------------
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings  ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- STEP 5: RLS Policies
-- ----------------------------------------------------------------

-- TEAMS ----------------------------------------------------------
CREATE POLICY "Anyone can read teams"
  ON teams FOR SELECT USING (true);

CREATE POLICY "Anyone can create a team"
  ON teams FOR INSERT WITH CHECK (true);

CREATE POLICY "Team members can update their team"
  ON teams FOR UPDATE
  USING (id IN (SELECT team_id FROM participants WHERE id = auth.uid()));

CREATE POLICY "Judges can delete empty teams"
  ON teams FOR DELETE
  USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));

-- JUDGES ---------------------------------------------------------
CREATE POLICY "Anyone can read judges"
  ON judges FOR SELECT USING (true);

-- PARTICIPANTS ---------------------------------------------------
CREATE POLICY "Anyone can register as participant"
  ON participants FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants can read their own team"
  ON participants FOR SELECT
  USING (
    team_id = get_my_team_id()
    OR EXISTS (SELECT 1 FROM judges WHERE id = auth.uid())
  );

CREATE POLICY "Participant can update themselves"
  ON participants FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Judges can update any participant"
  ON participants FOR UPDATE
  USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));

CREATE POLICY "Participant can delete themselves"
  ON participants FOR DELETE
  USING (id = auth.uid());

-- SUBMISSIONS ----------------------------------------------------
CREATE POLICY "Anyone can read submissions"
  ON submissions FOR SELECT USING (true);

CREATE POLICY "Team members can insert submission"
  ON submissions FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
    AND (SELECT value FROM system_settings WHERE key = 'submissions_enabled') = true
  );

CREATE POLICY "Team members can update submission while open"
  ON submissions FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
    AND (SELECT value FROM system_settings WHERE key = 'submissions_enabled') = true
  );

CREATE POLICY "Judges can update any submission (for ratings)"
  ON submissions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));

-- SCORES ---------------------------------------------------------
CREATE POLICY "Anyone can read scores"
  ON scores FOR SELECT USING (true);

CREATE POLICY "Judges can insert scores"
  ON scores FOR INSERT
  WITH CHECK (judge_id = auth.uid());

CREATE POLICY "Judges can update own scores"
  ON scores FOR UPDATE
  USING (judge_id = auth.uid());

-- MATCHUPS -------------------------------------------------------
CREATE POLICY "Judges can manage matchups"
  ON matchups FOR ALL
  USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));

CREATE POLICY "Anyone can read matchups"
  ON matchups FOR SELECT USING (true);

-- SYSTEM SETTINGS ------------------------------------------------
CREATE POLICY "Anyone can read settings"
  ON system_settings FOR SELECT USING (true);

CREATE POLICY "Judges can manage settings"
  ON system_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));


-- ----------------------------------------------------------------
-- STEP 6: Default Data
-- ----------------------------------------------------------------
INSERT INTO system_settings (key, value) VALUES
  ('submissions_enabled',    true),
  ('team_switching_enabled', true);


-- ----------------------------------------------------------------
-- STEP 7: Realtime (optional but nice for live dashboards)
-- ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;


-- ----------------------------------------------------------------
-- STEP 8: Confirm everything was created
-- ----------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
