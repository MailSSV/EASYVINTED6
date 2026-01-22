/*
  # Add automatic status change logic for articles

  ## Purpose
  Automatically reset related date fields when article status changes to maintain data consistency.

  ## Rules Implemented
  1. When status changes FROM 'scheduled' TO any other status (except 'published'):
     - Reset `scheduled_for` to NULL

  2. When status changes FROM 'sold' TO any other status:
     - Reset `sold_at` to NULL
     - Reset `sold_price` to NULL

  ## Technical Implementation
  - Creates a trigger function that runs BEFORE UPDATE on articles table
  - Only modifies fields when status actually changes
  - Ensures data consistency across all update operations

  ## Benefits
  - Prevents orphaned dates (e.g., a "ready" article with a scheduled_for date)
  - Centralizes business logic in the database
  - Works regardless of which client updates the data
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_article_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status has actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Rule 1: If changing FROM 'scheduled' to another status (except 'published')
    -- Reset the scheduled_for date
    IF OLD.status = 'scheduled' AND NEW.status != 'published' THEN
      NEW.scheduled_for := NULL;
    END IF;

    -- Rule 2: If changing FROM 'sold' to another status
    -- Reset sold_at and sold_price
    IF OLD.status = 'sold' AND NEW.status != 'sold' THEN
      NEW.sold_at := NULL;
      NEW.sold_price := NULL;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on articles table
DROP TRIGGER IF EXISTS trigger_article_status_change ON articles;

CREATE TRIGGER trigger_article_status_change
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION handle_article_status_change();

-- Add a helpful comment
COMMENT ON FUNCTION handle_article_status_change() IS
  'Automatically resets scheduled_for when leaving scheduled status, and sold_at/sold_price when leaving sold status';