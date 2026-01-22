/*
  # Create Kelly Insights Table

  1. New Tables
    - `kelly_insights`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `type` (text) - Insight type: price_drop, seasonal, stale, incomplete, opportunity, bundle
      - `priority` (text) - Priority level: high, medium, low
      - `title` (text) - Insight title
      - `message` (text) - Detailed message
      - `action_label` (text) - Label for the action button
      - `article_ids` (text[]) - Array of related article IDs
      - `suggested_action` (jsonb) - Suggested action details
      - `status` (text) - Status: active, dismissed, completed
      - `dismissed_at` (timestamptz) - When the insight was dismissed
      - `created_at` (timestamptz) - Creation timestamp
      - `expires_at` (timestamptz) - Expiration timestamp

  2. Security
    - Enable RLS on `kelly_insights` table
    - Add policies for authenticated users to manage their own insights
*/

CREATE TABLE IF NOT EXISTS kelly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('price_drop', 'seasonal', 'stale', 'incomplete', 'opportunity', 'bundle')),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title text NOT NULL,
  message text NOT NULL,
  action_label text NOT NULL,
  article_ids text[] DEFAULT '{}',
  suggested_action jsonb DEFAULT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'completed')),
  dismissed_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_kelly_insights_user_id ON kelly_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_status ON kelly_insights(status);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_type ON kelly_insights(type);

ALTER TABLE kelly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON kelly_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON kelly_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON kelly_insights
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON kelly_insights
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
