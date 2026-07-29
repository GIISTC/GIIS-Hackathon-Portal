-- ================================================================
-- GIIS HACKATHON 2K26 — ADMIN (OT) FULL CONTROL MIGRATION
-- Additive only — safe to run on top of everything else. Run this
-- in the Supabase SQL Editor.
--
-- Grants OT (judges.role = 'ot') full SELECT/INSERT/UPDATE/DELETE on
-- every participant-facing table: teams, participants, submissions,
-- side_quests, side_quest_details, side_quest_submissions,
-- side_quest_picks. This is what actually lets the new admin CRUD
-- routes (app/api/admin/teams, /participants, /submissions) work
-- when they run under the cookie-bound (RLS-enforced) client — the
-- routes still check judge.role === 'ot' themselves, this is the
-- database-level backstop so a direct REST call can't do more than
-- the UI allows, and can't do less either.
--
-- Also drops the old "closed/draft only" guardrails on side quests
-- so OT can edit or delete a quest in any status — those checks now
-- live only in the admin UI as a confirm dialog, not as a hard block.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. teams — OT can insert/update/delete any team (rename, change
--    track, or remove entirely). Deleting a team cascades to
--    participants (SET NULL) and submissions/criteria_scores/
--    side_quest_submissions/side_quest_picks (CASCADE), so this is
--    the single action that fully removes a team from the event.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Judges can update any team" ON teams;
DROP POLICY IF EXISTS "Judges can delete empty teams" ON teams;
DROP POLICY IF EXISTS "OT full control on teams" ON teams;
CREATE POLICY "OT full control on teams"
  ON teams FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

-- ----------------------------------------------------------------
-- 2. participants — OT can edit or remove any participant. Removing
--    a participant is how OT kicks someone off a team without going
--    through the participant's own "leave" flow.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Judges can update any participant" ON participants;
DROP POLICY IF EXISTS "OT full control on participants" ON participants;
CREATE POLICY "OT full control on participants"
  ON participants FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

-- ----------------------------------------------------------------
-- 3. submissions — OT can edit any field (not just ratings) or
--    delete a submission outright.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Judges can update any submission (for ratings)" ON submissions;
DROP POLICY IF EXISTS "OT full control on submissions" ON submissions;
CREATE POLICY "OT full control on submissions"
  ON submissions FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

-- ----------------------------------------------------------------
-- 4. side_quests / side_quest_details / side_quest_submissions /
--    side_quest_picks — OT already has ALL via is_ot() from earlier
--    migrations for details/submissions grading; add the same for
--    side_quests itself (currently only a SELECT policy covers OT)
--    and for side_quest_picks (currently no OT write policy exists,
--    so OT could not unstick a team's bad pick without this).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "OT can manage quests" ON side_quests;
DROP POLICY IF EXISTS "OT full control on side_quests" ON side_quests;
CREATE POLICY "OT full control on side_quests"
  ON side_quests FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

DROP POLICY IF EXISTS "OT can grade any submission" ON side_quest_submissions;
DROP POLICY IF EXISTS "OT full control on side_quest_submissions" ON side_quest_submissions;
CREATE POLICY "OT full control on side_quest_submissions"
  ON side_quest_submissions FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

DROP POLICY IF EXISTS "OT full control on side_quest_picks" ON side_quest_picks;
CREATE POLICY "OT full control on side_quest_picks"
  ON side_quest_picks FOR ALL
  USING (is_ot())
  WITH CHECK (is_ot());

-- ----------------------------------------------------------------
-- 5. Sanity check
-- ----------------------------------------------------------------
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'OT full control%'
ORDER BY tablename;
