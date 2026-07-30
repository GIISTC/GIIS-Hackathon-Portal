-- ================================================================
-- GIIS HACKATHON 2K26 — DAILY CHECK-IN MIGRATION
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- Adds a real per-day check-in record (Day 1 = July 31, Day 2 =
-- August 1) instead of the single one-shot participants.checked_in
-- flag. That flag is kept as-is (now means "checked in at least
-- once") so existing badges/stats elsewhere in the app keep working
-- without changes — the new `checkins` table is the actual per-day
-- source of truth used by the check-in scanner.
--
-- Also fixes a real gap from an earlier migration: "OT full control
-- on participants" made participants.checked_in only updatable by
-- OT, but the check-in scanner page has always been usable by any
-- judge (not just OT). This adds that access back for any judge,
-- without narrowing OT's existing full control.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. is_judge() — any judge (not OT-specific), mirrors is_ot().
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_judge()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM judges WHERE id = auth.uid());
$$;

-- Restore "any judge can check a participant in" (participants.checked_in /
-- checked_in_at) — this is an ADDITIONAL permissive policy alongside "OT
-- full control on participants", so it only adds access for non-OT judges;
-- OT keeps everything it already has.
DROP POLICY IF EXISTS "Judges can check in participants" ON participants;
CREATE POLICY "Judges can check in participants"
  ON participants FOR UPDATE
  USING (is_judge())
  WITH CHECK (is_judge());

-- ----------------------------------------------------------------
-- 2. checkins — one row per (participant, day). event_day: 1 = July
--    31, 2 = August 1.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_day      smallint NOT NULL CHECK (event_day IN (1, 2)),
  checked_in_at  timestamptz DEFAULT now(),
  checked_in_by  uuid REFERENCES judges(id) ON DELETE SET NULL,
  UNIQUE (participant_id, event_day)
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read checkins" ON checkins;
CREATE POLICY "Anyone can read checkins"
  ON checkins FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Judges can record checkins" ON checkins;
CREATE POLICY "Judges can record checkins"
  ON checkins FOR INSERT
  WITH CHECK (is_judge());

DROP POLICY IF EXISTS "OT can manage checkins" ON checkins;
CREATE POLICY "OT can manage checkins"
  ON checkins FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

-- Any judge can undo a check-in (the admin Attendance page lets you toggle
-- a day off). Without this, a non-OT judge's un-check silently does nothing.
DROP POLICY IF EXISTS "Judges can remove checkins" ON checkins;
CREATE POLICY "Judges can remove checkins"
  ON checkins FOR DELETE
  USING (is_judge());

-- ----------------------------------------------------------------
-- 3. Force PostgREST to pick up the new table immediately, otherwise
--    the API keeps returning "Could not find the table
--    'public.checkins' in the schema cache".
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------
-- 4. Sanity check — must return one row: checkins | true
-- ----------------------------------------------------------------
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checkins';
