-- ================================================================
-- GIIS HACKATHON 2K26 — TIER-BASED SIDE QUEST PICKS
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- Teams used to blind-pick ONE quest. Now they blind-pick a difficulty
-- TIER and unlock every quest in it — if there are 3 beginner quests,
-- picking Beginner reveals all 3.
--
-- The pick is still one per team and still irreversible. Existing picks
-- are preserved: each one is upgraded to a tier pick using the
-- difficulty of the quest that team already chose, so nobody loses
-- access or gets silently moved to a different tier.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. side_quest_picks now records a difficulty, not a single quest.
--    quest_id is kept (nullable) purely as a record of what the team
--    originally picked under the old model.
-- ----------------------------------------------------------------
ALTER TABLE side_quest_picks
  ADD COLUMN IF NOT EXISTS difficulty text;

UPDATE side_quest_picks p
SET difficulty = q.difficulty
FROM side_quests q
WHERE q.id = p.quest_id AND p.difficulty IS NULL;

ALTER TABLE side_quest_picks ALTER COLUMN quest_id DROP NOT NULL;

ALTER TABLE side_quest_picks DROP CONSTRAINT IF EXISTS side_quest_picks_difficulty_check;
ALTER TABLE side_quest_picks ADD CONSTRAINT side_quest_picks_difficulty_check
  CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));

-- ----------------------------------------------------------------
-- 2. Picking: one per team (the existing UNIQUE(team_id) still does
--    the enforcing), must name a tier that actually has an open quest.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team can create own pick" ON side_quest_picks;
CREATE POLICY "Team can create own pick"
  ON side_quest_picks FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND is_approved()
    AND difficulty IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM side_quests sq
      WHERE sq.difficulty = side_quest_picks.difficulty AND sq.status = 'open'
    )
  );
-- Still no UPDATE/DELETE policy — picks stay permanent.

-- ----------------------------------------------------------------
-- 3. Quest content unlocks for the whole tier, not one quest. This is
--    the actual secrecy boundary: the database refuses to return
--    details for a tier the team did not pick.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team can read own picked quest details" ON side_quest_details;
CREATE POLICY "Team can read own picked quest details"
  ON side_quest_details FOR SELECT
  USING (
    is_ot()
    OR EXISTS (
      SELECT 1
      FROM side_quest_picks p
      JOIN side_quests sq ON sq.id = side_quest_details.quest_id
      WHERE p.team_id = get_my_team_id()
        AND p.difficulty = sq.difficulty
    )
  );

-- ----------------------------------------------------------------
-- 4. Submitting: allowed for any open quest inside the picked tier.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team can submit while quest open" ON side_quest_submissions;
CREATE POLICY "Team can submit while quest open"
  ON side_quest_submissions FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (
      SELECT 1 FROM side_quests sq
      JOIN side_quest_picks p ON p.difficulty = sq.difficulty
      WHERE sq.id = side_quest_submissions.quest_id
        AND sq.status = 'open'
        AND p.team_id = get_my_team_id()
    )
  );

DROP POLICY IF EXISTS "Team can edit own submission while quest open" ON side_quest_submissions;
CREATE POLICY "Team can edit own submission while quest open"
  ON side_quest_submissions FOR UPDATE
  USING (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (
      SELECT 1 FROM side_quests sq
      JOIN side_quest_picks p ON p.difficulty = sq.difficulty
      WHERE sq.id = side_quest_submissions.quest_id
        AND sq.status = 'open'
        AND p.team_id = get_my_team_id()
    )
  );

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------
-- 5. Sanity check — every existing pick should now carry a tier.
-- ----------------------------------------------------------------
SELECT difficulty, COUNT(*) AS picks
FROM side_quest_picks
GROUP BY difficulty
ORDER BY difficulty;
