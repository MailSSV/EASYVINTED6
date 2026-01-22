/*
  # Ensure sold_price column exists in lots table

  ## Description
  Ensure the sold_price column exists in the lots table.
  This field tracks the actual sale price of a lot when sold.

  ## Changes
  - Add `sold_price` (numeric) - Actual sale price when lot is sold

  ## Important Notes
  - This field is separate from `price` (initial listing price)
  - Used for tracking actual revenue and calculating net profit
  - Only set when lot status is 'sold'
*/

-- Add sold_price field to lots table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'sold_price'
  ) THEN
    ALTER TABLE lots ADD COLUMN sold_price numeric(10,2);
    RAISE NOTICE 'Column sold_price added to lots table';
  ELSE
    RAISE NOTICE 'Column sold_price already exists in lots table';
  END IF;
END $$;
