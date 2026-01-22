/*
  # Add sold_price field to lots table

  ## Description
  Add a sold_price field to track the actual sale price of lots, separate from the initial price.
  This mirrors the sold_price field in the articles table and prevents data integrity issues.

  ## Changes
  - Add `sold_price` (numeric) - Actual sale price when lot is sold

  ## Important Notes
  - This field is separate from `price` (initial listing price)
  - Should be set when a lot's status changes to 'sold'
  - Allows tracking discounts/negotiations after initial listing
  - Mirrors the structure of the articles table
*/

-- Add sold_price field to lots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'sold_price'
  ) THEN
    ALTER TABLE lots ADD COLUMN sold_price numeric(10,2);
  END IF;
END $$;