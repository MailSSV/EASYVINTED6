/*
  # Initialize All Tables

  This migration creates all necessary tables for the EasyVinted application.

  1. New Tables
    - user_profiles
    - custom_personas
    - family_members
    - articles
    - lots
    - user_settings
    - publication_jobs
    - selling_suggestions

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
*/

-- ============================================
-- 1. USER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text DEFAULT '',
  phone_number text DEFAULT '',
  clothing_size text DEFAULT '',
  shoe_size text DEFAULT '',
  dressing_name text DEFAULT 'Mon Dressing',
  writing_style text DEFAULT 'friendly',
  persona_id text DEFAULT 'vinted_expert',
  default_seller_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_id_idx ON user_profiles(id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. CUSTOM PERSONAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS custom_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  tone text NOT NULL,
  style text NOT NULL,
  focus text NOT NULL,
  base_persona_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_personas_user_id_idx ON custom_personas(user_id);

ALTER TABLE custom_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personas"
  ON custom_personas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personas"
  ON custom_personas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personas"
  ON custom_personas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personas"
  ON custom_personas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 3. FAMILY MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age integer,
  clothing_size text,
  shoe_size text,
  writing_style text DEFAULT 'friendly',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_members_user_id_idx ON family_members(user_id);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own family members"
  ON family_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own family members"
  ON family_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family members"
  ON family_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own family members"
  ON family_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Now add the FK constraint to user_profiles
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_default_seller_id_fkey
FOREIGN KEY (default_seller_id) REFERENCES family_members(id) ON DELETE SET NULL;

-- ============================================
-- 4. ARTICLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  price numeric(10, 2) DEFAULT 0,
  brand text DEFAULT '',
  size text DEFAULT '',
  condition text DEFAULT '',
  color text,
  material text,
  status text DEFAULT 'draft',
  photos jsonb DEFAULT '[]'::jsonb,
  season text,
  suggested_period text,
  scheduled_for timestamptz,
  sold_at timestamptz,
  sold_price numeric(10, 2),
  platform text,
  buyer_name text,
  shipping_cost numeric(10, 2) DEFAULT 0,
  fees numeric(10, 2) DEFAULT 0,
  net_profit numeric(10, 2),
  sale_notes text,
  vinted_url text,
  published_at timestamptz,
  seller_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  reference_number text,
  sold_lot_id uuid,
  estimated_weight numeric(10, 2),
  shipping_estimate numeric(10, 2),
  shipping_carrier_preferred text,
  shipping_band_label text,
  suggested_price_min numeric(10, 2),
  suggested_price_max numeric(10, 2),
  seo_keywords jsonb DEFAULT '[]'::jsonb,
  hashtags jsonb DEFAULT '[]'::jsonb,
  search_terms jsonb DEFAULT '[]'::jsonb,
  ai_confidence_score numeric(5, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_user_id_idx ON articles(user_id);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status);
CREATE INDEX IF NOT EXISTS articles_seller_id_idx ON articles(seller_id);
CREATE INDEX IF NOT EXISTS articles_scheduled_for_idx ON articles(scheduled_for);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own articles"
  ON articles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own articles"
  ON articles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles"
  ON articles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles"
  ON articles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 5. LOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category_id integer,
  season text,
  price numeric(10, 2) DEFAULT 0,
  original_total_price numeric(10, 2),
  discount_percentage numeric(5, 2),
  photos jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft',
  scheduled_for timestamptz,
  sold_at timestamptz,
  sold_price numeric(10, 2),
  platform text,
  buyer_name text,
  shipping_cost numeric(10, 2) DEFAULT 0,
  sale_notes text,
  vinted_url text,
  reference_number text,
  seller_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  seo_keywords jsonb DEFAULT '[]'::jsonb,
  hashtags jsonb DEFAULT '[]'::jsonb,
  search_terms jsonb DEFAULT '[]'::jsonb,
  ai_confidence_score numeric(5, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lots_user_id_idx ON lots(user_id);
CREATE INDEX IF NOT EXISTS lots_status_idx ON lots(status);
CREATE INDEX IF NOT EXISTS lots_seller_id_idx ON lots(seller_id);
CREATE INDEX IF NOT EXISTS lots_scheduled_for_idx ON lots(scheduled_for);

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lots"
  ON lots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lots"
  ON lots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lots"
  ON lots FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lots"
  ON lots FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Now add FK constraint to articles
ALTER TABLE articles
ADD CONSTRAINT articles_sold_lot_id_fkey
FOREIGN KEY (sold_lot_id) REFERENCES lots(id) ON DELETE SET NULL;

-- ============================================
-- 6. USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_publish boolean DEFAULT false,
  publish_time time DEFAULT '09:00:00',
  notification_email boolean DEFAULT true,
  notification_sms boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_settings_user_id_idx ON user_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. PUBLICATION JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS publication_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES lots(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  published_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publication_jobs_user_id_idx ON publication_jobs(user_id);
CREATE INDEX IF NOT EXISTS publication_jobs_article_id_idx ON publication_jobs(article_id);
CREATE INDEX IF NOT EXISTS publication_jobs_lot_id_idx ON publication_jobs(lot_id);
CREATE INDEX IF NOT EXISTS publication_jobs_status_idx ON publication_jobs(status);
CREATE INDEX IF NOT EXISTS publication_jobs_scheduled_for_idx ON publication_jobs(scheduled_for);

ALTER TABLE publication_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON publication_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON publication_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON publication_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON publication_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 8. SELLING SUGGESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS selling_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
  lot_id uuid UNIQUE REFERENCES lots(id) ON DELETE CASCADE,
  suggested_period text,
  suggested_timing text,
  reasoning text,
  confidence_score numeric(3, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS selling_suggestions_user_id_idx ON selling_suggestions(user_id);
CREATE INDEX IF NOT EXISTS selling_suggestions_article_id_idx ON selling_suggestions(article_id);
CREATE INDEX IF NOT EXISTS selling_suggestions_lot_id_idx ON selling_suggestions(lot_id);

ALTER TABLE selling_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions"
  ON selling_suggestions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own suggestions"
  ON selling_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions"
  ON selling_suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions"
  ON selling_suggestions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 9. TRIGGERS
-- ============================================

-- Trigger to auto-update articles status when lot is sold
CREATE OR REPLACE FUNCTION update_articles_when_lot_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    UPDATE articles
    SET status = 'vendu_en_lot',
        sold_lot_id = NEW.id,
        updated_at = now()
    WHERE id IN (
      SELECT unnest(string_to_array(NEW.sale_notes, ','))::uuid
    )
    AND status != 'vendu_en_lot';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_articles_when_lot_sold
  AFTER UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_when_lot_sold();