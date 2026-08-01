-- Bridge: let the OLD deployed client (which sends quest_id only) still
-- create a valid tier pick. A BEFORE INSERT trigger runs before the RLS
-- WITH CHECK is evaluated, so filling difficulty here satisfies the policy.
CREATE OR REPLACE FUNCTION fill_pick_difficulty()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.difficulty IS NULL AND NEW.quest_id IS NOT NULL THEN
    SELECT difficulty INTO NEW.difficulty FROM side_quests WHERE id = NEW.quest_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_pick_difficulty ON side_quest_picks;
CREATE TRIGGER trg_fill_pick_difficulty
  BEFORE INSERT ON side_quest_picks
  FOR EACH ROW EXECUTE FUNCTION fill_pick_difficulty();
