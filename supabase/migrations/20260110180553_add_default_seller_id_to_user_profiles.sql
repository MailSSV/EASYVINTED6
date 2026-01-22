/*
  # Add default_seller_id to user_profiles

  1. Changes
    - Add `default_seller_id` column to `user_profiles` table
    - Foreign key reference to `family_members` table
    - Nullable to allow users without family members

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'default_seller_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN default_seller_id uuid REFERENCES family_members(id) ON DELETE SET NULL;
  END IF;
END $$;
