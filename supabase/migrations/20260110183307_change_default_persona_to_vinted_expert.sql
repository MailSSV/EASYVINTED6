/*
  # Change default persona to Vinted expert

  1. Changes
    - Update default value of `persona_id` column in `family_members` table from 'casual' to 'vinted_expert'
    - This makes "Vinted expert" the default writing style for all new family members and sellers
  
  2. Important Notes
    - Existing records are not affected, only new inserts will use the new default
    - The Vinted expert persona uses short, bullet-point descriptions optimized for sales
*/

-- Change the default value for persona_id in family_members table
ALTER TABLE family_members 
ALTER COLUMN persona_id SET DEFAULT 'vinted_expert';
