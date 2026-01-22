/*
  # Add 'reserved' status for articles in lots

  ## Overview
  This migration introduces a 'reserved' status for articles that are included in lots.
  When an article is added to a lot, it becomes "reserved" and should not be published
  individually outside the lot context.

  ## Changes

  1. **New Column**
    - `previous_status` (text) - Stores the status before the article was reserved

  2. **Status Management**
    - Add 'reserved' as a valid status value
    - Add CHECK constraint to enforce valid status values

  3. **Automatic Status Updates**
    - When article added to lot → status becomes 'reserved'
    - When article removed from lot → status returns to previous value
    - Previous status is stored before setting to 'reserved'

  ## Security
  - No changes to RLS policies needed

  ## Important Notes
  - Articles with status 'reserved' should be excluded from individual publication flows
  - The trigger handles status changes automatically
  - If an article is already 'sold' or 'vendu_en_lot', it cannot be reserved
*/

-- Add previous_status column to store status before reservation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'previous_status'
  ) THEN
    ALTER TABLE articles ADD COLUMN previous_status text;
  END IF;
END $$;

-- Add CHECK constraint for valid status values including 'reserved'
DO $$
BEGIN
  -- Drop existing constraint if any
  ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;

  -- Add new constraint with 'reserved' included
  ALTER TABLE articles ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'ready', 'scheduled', 'published', 'vinted_draft', 'sold', 'vendu_en_lot', 'reserved'));
END $$;

-- Function to set article status to 'reserved' when added to a lot
CREATE OR REPLACE FUNCTION set_article_reserved_on_lot_add()
RETURNS TRIGGER AS $$
BEGIN
  -- Store current status as previous_status and set status to 'reserved'
  UPDATE articles
  SET
    previous_status = status,
    status = 'reserved',
    updated_at = now()
  WHERE id = NEW.article_id
  AND status NOT IN ('sold', 'vendu_en_lot', 'reserved'); -- Don't override sold articles

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to restore article status when removed from a lot
CREATE OR REPLACE FUNCTION restore_article_status_on_lot_remove()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if article is not in any other active lot
  IF NOT EXISTS (
    SELECT 1 FROM lot_items
    WHERE article_id = OLD.article_id
    AND id != OLD.id
  ) THEN
    -- Restore previous status or default to 'draft'
    UPDATE articles
    SET
      status = COALESCE(previous_status, 'draft'),
      previous_status = NULL,
      updated_at = now()
    WHERE id = OLD.article_id
    AND status = 'reserved';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set status to 'reserved' when article is added to a lot
DROP TRIGGER IF EXISTS trigger_set_article_reserved ON lot_items;
CREATE TRIGGER trigger_set_article_reserved
  AFTER INSERT ON lot_items
  FOR EACH ROW
  EXECUTE FUNCTION set_article_reserved_on_lot_add();

-- Trigger to restore status when article is removed from a lot
DROP TRIGGER IF EXISTS trigger_restore_article_status ON lot_items;
CREATE TRIGGER trigger_restore_article_status
  AFTER DELETE ON lot_items
  FOR EACH ROW
  EXECUTE FUNCTION restore_article_status_on_lot_remove();

-- Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
