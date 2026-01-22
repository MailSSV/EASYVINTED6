/*
  # Add processing and error status values to articles

  1. Changes
    - Add CHECK constraint to articles.status field to enforce valid status values
    - Allows: draft, ready, scheduled, published, sold, vendu_en_lot, processing, error

  2. Notes
    - Uses IF NOT EXISTS pattern to safely add constraint
    - processing: For articles currently being processed/published
    - error: For articles that encountered errors during processing
*/

-- Add CHECK constraint for status field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articles_status_check'
  ) THEN
    ALTER TABLE articles
    ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'ready', 'scheduled', 'published', 'sold', 'vendu_en_lot', 'processing', 'error'));
  END IF;
END $$;
