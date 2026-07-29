-- ================================================================
-- GIIS HACKATHON 2K26 — TRACK-BY-GRADE MIGRATION
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- New rule: Juniors (Grades 6-8) have no track — they can build
-- anything and rank on one combined Junior leaderboard. Seniors
-- (Grades 9-12) must pick one of exactly 2 tracks: "App/Web Dev" or
-- "Game Dev" — collapsing the old 3-way App Dev / Web Dev / Game Dev
-- split (they already shared one leaderboard pool anyway).
--
-- This migration retags any existing team on the old 3 values,
-- then tightens the CHECK constraint to the new 2.
-- ================================================================

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_track_check;

UPDATE teams SET track = 'App/Web Dev' WHERE track IN ('App Dev', 'Web Dev');

ALTER TABLE teams ADD CONSTRAINT teams_track_check
  CHECK (track IS NULL OR track IN ('App/Web Dev', 'Game Dev'));

-- Sanity check
SELECT track, count(*) FROM teams GROUP BY track ORDER BY track;
