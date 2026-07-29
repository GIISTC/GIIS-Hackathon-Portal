-- ================================================================
-- GIIS HACKATHON 2K26 — SIDE QUEST BLIND-CHOICE MIGRATION
-- Additive only — safe to run on top of points_system_migration.sql.
-- Run this in the Supabase SQL Editor.
--
-- Adds: side_quests.difficulty, a private Storage bucket for quest
-- images, side_quest_details (title/description/images — the actual
-- "content" of a quest), and side_quest_picks (one irreversible pick
-- per team).
--
-- Design: a team should be able to see that a Beginner / Intermediate
-- / Advanced quest exists (and its point value) without seeing what
-- it actually is, then blind-pick one — after which every other
-- quest is locked out for that team, permanently. This is enforced
-- in Postgres via RLS, not just hidden in the UI: side_quest_details
-- (title, description, image_paths) is only readable by OT or by the
-- team that has already picked that exact quest, so a participant
-- calling the Supabase REST API directly still can't read another
-- quest's content. side_quests itself keeps its existing permissive
-- SELECT policy (open/closed OR OT) since difficulty + points are
-- meant to be visible pre-pick — that's the whole "blind gamble".
-- ================================================================

-- ----------------------------------------------------------------
-- 1. side_quests: add difficulty tier. title/description are no
--    longer required here going forward (superseded by
--    side_quest_details below) — relaxed to nullable rather than
--    dropped, so nothing breaks if any quest was already created
--    under the old model.
-- ----------------------------------------------------------------
ALTER TABLE side_quests ADD COLUMN IF NOT EXISTS difficulty text
  CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));

ALTER TABLE side_quests ALTER COLUMN title DROP NOT NULL;
ALTER TABLE side_quests ALTER COLUMN description DROP NOT NULL;

-- ----------------------------------------------------------------
-- 2. Private Storage bucket for quest images. Never made public —
--    all reads go through signed URLs minted server-side in
--    app/api/side-quests/[id]/images, gated by the same pick check
--    as the RLS policy below. No storage.objects policies are
--    needed since only the service-role client touches this bucket.
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('quest-images', 'quest-images', false)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. side_quest_details — the actual "content" of a quest, split out
--    into its own RLS-gated table (same pattern as criteria_scores
--    hiding bonus fields from participants).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS side_quest_details (
  quest_id      uuid PRIMARY KEY REFERENCES side_quests(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL,
  image_paths   text[] NOT NULL DEFAULT '{}',
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE side_quest_details ENABLE ROW LEVEL SECURITY;

-- Backfill any quest created under the old (pre-blind-choice) model
-- so it keeps working.
INSERT INTO side_quest_details (quest_id, title, description)
SELECT id, title, description FROM side_quests
WHERE title IS NOT NULL AND description IS NOT NULL
ON CONFLICT (quest_id) DO NOTHING;

-- ----------------------------------------------------------------
-- 4. side_quest_picks — one irreversible pick per team. The
--    UNIQUE(team_id) constraint is what actually locks every other
--    quest out once a team has chosen: a second insert attempt for
--    the same team fails at the database level, not just in the UI.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS side_quest_picks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  quest_id   uuid NOT NULL REFERENCES side_quests(id) ON DELETE CASCADE,
  picked_at  timestamptz DEFAULT now()
);

ALTER TABLE side_quest_picks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 5. RLS policies
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "Team can read own pick" ON side_quest_picks;
CREATE POLICY "Team can read own pick"
  ON side_quest_picks FOR SELECT
  USING (team_id = get_my_team_id() OR is_ot());

DROP POLICY IF EXISTS "Team can create own pick" ON side_quest_picks;
CREATE POLICY "Team can create own pick"
  ON side_quest_picks FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
  );
-- No UPDATE/DELETE policy — picks are permanent. RLS denies both by default.

DROP POLICY IF EXISTS "OT can manage quest details" ON side_quest_details;
CREATE POLICY "OT can manage quest details"
  ON side_quest_details FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

DROP POLICY IF EXISTS "Team can read own picked quest details" ON side_quest_details;
CREATE POLICY "Team can read own picked quest details"
  ON side_quest_details FOR SELECT
  USING (
    is_ot()
    OR EXISTS (
      SELECT 1 FROM side_quest_picks p
      WHERE p.team_id = get_my_team_id() AND p.quest_id = side_quest_details.quest_id
    )
  );

-- ----------------------------------------------------------------
-- 6. Sanity check
-- ----------------------------------------------------------------
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('side_quests', 'side_quest_details', 'side_quest_picks', 'side_quest_submissions')
ORDER BY tablename;
