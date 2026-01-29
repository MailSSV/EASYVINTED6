/*
  # Create Kelly Insights Table with Caching System

  1. New Tables
    - `kelly_insights`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `type` (text) - Insight type
      - `priority` (text) - Priority level: high, medium, low
      - `title` (text) - Insight title
      - `message` (text) - Detailed message
      - `action_label` (text) - Label for the action button
      - `article_ids` (text[]) - Array of related article IDs
      - `suggested_action` (jsonb) - Suggested action details
      - `status` (text) - Status: active, dismissed, completed
      - `dismissed_at` (timestamptz) - When the insight was dismissed
      - `cache_key` (text) - Cache key for identifying cache entries
      - `last_refresh_at` (timestamptz) - When insights were last generated
      - `created_at` (timestamptz) - Creation timestamp
      - `expires_at` (timestamptz) - Expiration timestamp (30 minutes default)

  2. Security
    - Enable RLS on `kelly_insights` table
    - Add policies for authenticated users to manage their own insights

  3. Purpose
    - Stores Kelly AI insights with 30-minute cache to reduce API costs by 80-90%
    - Insights are refreshed only when cache expires or user explicitly refreshes
*/

CREATE TABLE IF NOT EXISTS kelly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'ready_to_publish',
    'ready_to_list',
    'price_drop',
    'seasonal',
    'stale',
    'incomplete',
    'seo_optimization',
    'opportunity',
    'bundle'
  )),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title text NOT NULL,
  message text NOT NULL,
  action_label text NOT NULL,
  article_ids text[] DEFAULT '{}',
  suggested_action jsonb DEFAULT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'completed')),
  dismissed_at timestamptz DEFAULT NULL,
  cache_key text DEFAULT 'default',
  last_refresh_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_kelly_insights_user_id ON kelly_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_status ON kelly_insights(status);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_type ON kelly_insights(type);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_cache_key ON kelly_insights(user_id, cache_key, last_refresh_at);
CREATE INDEX IF NOT EXISTS idx_kelly_insights_expires_at ON kelly_insights(expires_at);

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

-- Create a function to clean up old/expired insights automatically
CREATE OR REPLACE FUNCTION cleanup_expired_kelly_insights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM kelly_insights
  WHERE expires_at < now()
     OR (status = 'dismissed' AND dismissed_at < now() - interval '7 days');
END;
$$;

COMMENT ON TABLE kelly_insights IS 'Stores Kelly AI insights with 30-minute cache to reduce API costs by 80-90%. Insights are refreshed only when cache expires or when user explicitly refreshes.';