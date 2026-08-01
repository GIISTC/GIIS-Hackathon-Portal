-- ================================================================
-- GIIS HACKATHON 2K26 — CHOOSE ONE QUEST WITHIN THE PICKED TIER
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- Picking is now two stages:
--   1. Blind-pick a difficulty tier      -> side_quest_picks.difficulty
--   2. See every quest in that tier and
--      choose ONE to attempt              -> side_quest_picks.quest_id
--
-- Both stages are permanent. Teams that picked under the old
-- one-quest model already have quest_id set, so they are treated as
-- having completed stage 2 and nothing changes for them.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Stage 2 needs an UPDATE path on picks, which deliberately did
--    not exist before. It is allowed only while quest_id is still
--    unset, so a team still gets exactly one shot at each stage.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team can choose quest within picked tier" ON side_quest_picks;
CREATE POLICY "Team can choose quest within picked tier"
  ON side_quest_picks FOR UPDATE
  USING (
    team_id = get_my_team_id()
    AND is_approved()
    AND quest_id IS NULL
  )
  WITH CHECK (
    team_id = get_my_team_id()
    AND quest_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM side_quests sq
      WHERE sq.id = side_quest_picks.quest_id
        AND sq.difficulty = side_quest_picks.difficulty
        AND sq.status = 'open'
    )
  );

-- RLS alone can't express "this column may never change again", so a
-- trigger is the backstop: the tier can't be swapped, and a chosen
-- quest can't be swapped for another one.
CREATE OR REPLACE FUNCTION freeze_quest_pick()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- OT has its own "full control" policy on this table specifically so
  -- a wrong pick can be corrected by hand — this freeze is only meant to
  -- stop a team from re-rolling its own choice.
  IF is_ot() THEN
    RETURN NEW;
  END IF;
  IF NEW.difficulty IS DISTINCT FROM OLD.difficulty THEN
    RAISE EXCEPTION 'The difficulty tier is locked in and cannot be changed.';
  END IF;
  IF OLD.quest_id IS NOT NULL AND NEW.quest_id IS DISTINCT FROM OLD.quest_id THEN
    RAISE EXCEPTION 'Your team has already chosen its quest — that choice is final.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_quest_pick ON side_quest_picks;
CREATE TRIGGER trg_freeze_quest_pick
  BEFORE UPDATE ON side_quest_picks
  FOR EACH ROW EXECUTE FUNCTION freeze_quest_pick();

-- ----------------------------------------------------------------
-- 2. Submitting is now limited to the ONE chosen quest, not the whole
--    tier. Reading quest content stays tier-wide so the team can
--    actually compare the options before committing.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team can submit while quest open" ON side_quest_submissions;
CREATE POLICY "Team can submit while quest open"
  ON side_quest_submissions FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (
      SELECT 1 FROM side_quest_picks p
      JOIN side_quests sq ON sq.id = p.quest_id
      WHERE p.team_id = get_my_team_id()
        AND p.quest_id = side_quest_submissions.quest_id
        AND sq.status = 'open'
    )
  );

DROP POLICY IF EXISTS "Team can edit own submission while quest open" ON side_quest_submissions;
CREATE POLICY "Team can edit own submission while quest open"
  ON side_quest_submissions FOR UPDATE
  USING (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (
      SELECT 1 FROM side_quest_picks p
      JOIN side_quests sq ON sq.id = p.quest_id
      WHERE p.team_id = get_my_team_id()
        AND p.quest_id = side_quest_submissions.quest_id
        AND sq.status = 'open'
    )
  );

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------
-- 3. Sanity check — picks still awaiting a quest choice vs. settled.
-- ----------------------------------------------------------------
SELECT difficulty,
       COUNT(*) FILTER (WHERE quest_id IS NULL) AS awaiting_quest_choice,
       COUNT(*) FILTER (WHERE quest_id IS NOT NULL) AS quest_chosen
FROM side_quest_picks
GROUP BY difficulty ORDER BY difficulty;
