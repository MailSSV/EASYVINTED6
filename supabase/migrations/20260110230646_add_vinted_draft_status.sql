/*
  # Add vinted_draft status to articles and lots

  1. Changes
    - Update articles.status CHECK constraint to include 'vinted_draft'
    - Update lots.status CHECK constraint to include 'vinted_draft'
    - vinted_draft: Item saved as draft on Vinted but not fully published yet
    - published: Item fully published and live on Vinted

  2. Status Flow
    - draft → ready → scheduled → processing → vinted_draft → published → sold
    - vinted_draft indicates the item is saved on Vinted but not yet public
    - published confirms the item is live and visible on Vinted

  3. Notes
    - Drops existing constraint and recreates with new values
    - Safe to run multiple times
*/

-- Update articles table status constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articles_status_check'
  ) THEN
    ALTER TABLE articles DROP CONSTRAINT articles_status_check;
  END IF;

  -- Add new constraint with vinted_draft included
  ALTER TABLE articles
  ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'ready', 'scheduled', 'published', 'sold', 'vendu_en_lot', 'processing', 'error', 'vinted_draft'));
END $$;

-- Update lots table status constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lots_status_check'
  ) THEN
    ALTER TABLE lots DROP CONSTRAINT lots_status_check;
  END IF;

  -- Add new constraint with vinted_draft included
  ALTER TABLE lots
  ADD CONSTRAINT lots_status_check
  CHECK (status IN ('draft', 'ready', 'scheduled', 'published', 'sold', 'processing', 'error', 'vinted_draft'));
END $$;