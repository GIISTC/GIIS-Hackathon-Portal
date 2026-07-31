-- ================================================================
-- GIIS HACKATHON 2K26 — SIDE QUEST FILE ATTACHMENTS
-- Additive/safe — run this in the Supabase SQL Editor.
--
-- Replaces the image-only attachment model with general file
-- attachments of any type (images, .py, .json, .zip, .csv, whatever).
-- Participants download them from a button instead of scrolling a
-- slideshow.
--
-- Existing images are NOT lost — they get folded into the new `files`
-- column so they keep showing up, now as downloadable attachments.
-- The old image_paths column is left in place untouched, so this is
-- fully reversible.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. files — array of { path, name, size, type }.
--    path = storage key, name = original filename shown to users.
-- ----------------------------------------------------------------
ALTER TABLE side_quest_details
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------------------------------
-- 2. Carry any already-uploaded images over into `files`. Only runs
--    for rows that have images but no files yet, so re-running this
--    migration will not duplicate entries.
-- ----------------------------------------------------------------
UPDATE side_quest_details d
SET files = (
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'path', p,
      'name', regexp_replace(p, '^.*/', ''),
      'size', 0,
      'type', 'image/*'
    )), '[]'::jsonb)
  FROM unnest(d.image_paths) AS p
)
WHERE COALESCE(array_length(d.image_paths, 1), 0) > 0
  AND (d.files IS NULL OR d.files = '[]'::jsonb);

-- ----------------------------------------------------------------
-- 3. The bucket already exists and is private (created by the side
--    quest migration). No MIME restriction is set on it, so every
--    file type is accepted. Set an explicit 25MB per-file ceiling so
--    the limit is predictable rather than inherited from the project
--    default.
-- ----------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 26214400
WHERE id = 'quest-images';

-- ----------------------------------------------------------------
-- 4. Reload the API schema cache so `files` is visible immediately.
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------
-- 5. Sanity check — should list the new files column, and show the
--    bucket as private with a 25MB limit.
-- ----------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'side_quest_details' AND column_name IN ('files', 'image_paths');

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'quest-images';
