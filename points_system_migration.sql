-- ================================================================
-- GIIS HACKATHON 2K26 — POINTS SYSTEM MIGRATION
-- Additive only — safe to run on top of either supabase_schema.sql
-- or fix_database.sql. Run this in the Supabase SQL Editor.
--
-- Adds: teams.track (+ constraint), is_ot() helper, criteria_scores,
-- side_quests, side_quest_submissions, plus RLS policies for all.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. teams: ensure track (+ project_name defensively) exist.
--    supabase_schema.sql has both columns; fix_database.sql dropped
--    them — add defensively so this runs cleanly either way.
-- ----------------------------------------------------------------
ALTER TABLE teams ADD COLUMN IF NOT EXISTS track text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS project_name text;

DO $$ BEGIN
  ALTER TABLE teams ADD CONSTRAINT teams_track_check
    CHECK (track IS NULL OR track IN ('App Dev', 'Web Dev', 'Game Dev'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Judges need write access to backfill/correct a team's track on
-- legacy or misregistered teams — no such policy exists today
-- (only the team's own members can UPDATE their team).
DO $$ BEGIN
  CREATE POLICY "Judges can update any team"
    ON teams FOR UPDATE
    USING (EXISTS (SELECT 1 FROM judges WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 2. is_ot() — OT-only helper, mirrors get_my_team_id() pattern.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_ot()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM judges WHERE id = auth.uid() AND role = 'ot'
  );
$$;

-- ----------------------------------------------------------------
-- 3. criteria_scores — one row per (team, OT judge).
--    7 PUBLIC criteria (max 150) + 5 SECRET bonus fields (max 65).
--    RLS grants SELECT to OT only — this is what actually prevents
--    a participant from reading raw bonus columns via devtools or
--    a direct REST call, not just UI hiding.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS criteria_scores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  judge_id              uuid NOT NULL REFERENCES judges(id) ON DELETE CASCADE,

  -- Public criteria (sum max = 150)
  relevance             int NOT NULL CHECK (relevance BETWEEN 0 AND 30),
  creativity            int NOT NULL CHECK (creativity BETWEEN 0 AND 25),
  functionality         int NOT NULL CHECK (functionality BETWEEN 0 AND 25),
  ux                    int NOT NULL CHECK (ux BETWEEN 0 AND 20),
  presentation          int NOT NULL CHECK (presentation BETWEEN 0 AND 20),
  code_quality          int NOT NULL CHECK (code_quality BETWEEN 0 AND 15),
  completeness          int NOT NULL CHECK (completeness BETWEEN 0 AND 15),

  -- SECRET bonus (sum max = 65) — OT-only, never exposed to others
  bonus_mvp             int NOT NULL DEFAULT 0 CHECK (bonus_mvp BETWEEN 0 AND 20),
  bonus_api             int NOT NULL DEFAULT 0 CHECK (bonus_api BETWEEN 0 AND 20),
  bonus_database        int NOT NULL DEFAULT 0 CHECK (bonus_database BETWEEN 0 AND 10),
  bonus_auth            int NOT NULL DEFAULT 0 CHECK (bonus_auth BETWEEN 0 AND 5),
  bonus_original_assets int NOT NULL DEFAULT 0 CHECK (bonus_original_assets BETWEEN 0 AND 10),

  notes                 text,
  scored_at             timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(team_id, judge_id)
);

ALTER TABLE criteria_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "OT can read all criteria scores"
    ON criteria_scores FOR SELECT USING (is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "OT can insert own criteria scores"
    ON criteria_scores FOR INSERT
    WITH CHECK (judge_id = auth.uid() AND is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "OT can update own criteria scores"
    ON criteria_scores FOR UPDATE
    USING (judge_id = auth.uid() AND is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 4. side_quests — OT-managed, event-wide (not track-specific).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS side_quests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text NOT NULL,
  points       int  NOT NULL CHECK (points > 0),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  created_by   uuid REFERENCES judges(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  opened_at    timestamptz,
  closed_at    timestamptz
);

ALTER TABLE side_quests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read published quests"
    ON side_quests FOR SELECT
    USING (status IN ('open', 'closed') OR is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "OT can manage quests"
    ON side_quests FOR ALL
    USING (is_ot())
    WITH CHECK (is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 5. side_quest_submissions — one per (quest, team). Text + optional
--    link only (no file upload — no storage bucket configured).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS side_quest_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id      uuid NOT NULL REFERENCES side_quests(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  submitted_by  uuid REFERENCES participants(id) ON DELETE SET NULL,
  response_text text NOT NULL,
  response_link text,
  verdict       text NOT NULL DEFAULT 'pending' CHECK (verdict IN ('pending', 'correct', 'incorrect')),
  graded_by     uuid REFERENCES judges(id) ON DELETE SET NULL,
  graded_at     timestamptz,
  submitted_at  timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(quest_id, team_id)
);

ALTER TABLE side_quest_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Team can read own side quest submissions"
    ON side_quest_submissions FOR SELECT
    USING (team_id = get_my_team_id() OR is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team can submit while quest open"
    ON side_quest_submissions FOR INSERT
    WITH CHECK (
      team_id = get_my_team_id()
      AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team can edit own submission while quest open"
    ON side_quest_submissions FOR UPDATE
    USING (
      team_id = get_my_team_id()
      AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "OT can grade any submission"
    ON side_quest_submissions FOR UPDATE
    USING (is_ot());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 6. Confirm everything was created
-- ----------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('criteria_scores', 'side_quests', 'side_quest_submissions')
ORDER BY table_name;
