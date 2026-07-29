-- ================================================================
-- GIIS HACKATHON 2K26 — PARTICIPANT APPROVAL MIGRATION
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- New rule: every new participant registration starts 'pending' and
-- can't submit a project, pick a side quest, or switch teams until
-- an OT member approves them from /admin/approvals. Existing
-- participants (registered before this migration) are grandfathered
-- in as 'approved' so nobody already using the portal gets locked
-- out.
--
-- Enforced in Postgres, not just the UI: is_approved() gates the
-- write policies a pending participant would otherwise use, and a
-- trigger stops a participant from ever approving themselves via a
-- direct REST call — only OT can flip approval_status.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. participants.approval_status
-- ----------------------------------------------------------------
ALTER TABLE participants ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Grandfather in everyone who registered before this migration ran.
UPDATE participants SET approval_status = 'approved' WHERE approval_status = 'pending';

-- ----------------------------------------------------------------
-- 2. is_approved() helper, mirrors is_ot()/get_my_team_id().
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_approved()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM participants WHERE id = auth.uid() AND approval_status = 'approved'
  );
$$;

-- ----------------------------------------------------------------
-- 3. Trigger — only OT can change approval_status. Without this, a
--    participant could self-approve with a direct REST call to
--    PATCH their own row, since "Participant can update themselves"
--    has no column-level restriction.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_self_approval()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status AND NOT is_ot() THEN
    NEW.approval_status := OLD.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_approval ON participants;
CREATE TRIGGER trg_prevent_self_approval
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION prevent_self_approval();

-- ----------------------------------------------------------------
-- 4. Gate the write policies a pending participant would use.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Team members can insert submission" ON submissions;
CREATE POLICY "Team members can insert submission"
  ON submissions FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
    AND (SELECT value FROM system_settings WHERE key = 'submissions_enabled') = true
    AND is_approved()
  );

DROP POLICY IF EXISTS "Team members can update submission while open" ON submissions;
CREATE POLICY "Team members can update submission while open"
  ON submissions FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
    AND (SELECT value FROM system_settings WHERE key = 'submissions_enabled') = true
    AND is_approved()
  );

DROP POLICY IF EXISTS "Team can create own pick" ON side_quest_picks;
CREATE POLICY "Team can create own pick"
  ON side_quest_picks FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
  );

DROP POLICY IF EXISTS "Team can submit while quest open" ON side_quest_submissions;
CREATE POLICY "Team can submit while quest open"
  ON side_quest_submissions FOR INSERT
  WITH CHECK (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
  );

DROP POLICY IF EXISTS "Team can edit own submission while quest open" ON side_quest_submissions;
CREATE POLICY "Team can edit own submission while quest open"
  ON side_quest_submissions FOR UPDATE
  USING (
    team_id = get_my_team_id()
    AND is_approved()
    AND EXISTS (SELECT 1 FROM side_quests sq WHERE sq.id = quest_id AND sq.status = 'open')
  );

-- ----------------------------------------------------------------
-- 5. Sanity check
-- ----------------------------------------------------------------
SELECT approval_status, count(*) FROM participants GROUP BY approval_status ORDER BY approval_status;
