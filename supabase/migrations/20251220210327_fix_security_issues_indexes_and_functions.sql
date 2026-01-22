/*
  # Fix Security Issues - Indexes and Functions
  
  This migration addresses multiple security and performance issues:

  ## 1. Missing Indexes on Foreign Keys
    - Add index on `lots.seller_id` to improve query performance
    - Add index on `user_profiles.default_seller_id` to improve query performance
    
  ## 2. Remove Unused Index
    - Drop `idx_user_profiles_custom_persona_id` which is not being used
    
  ## 3. Fix Function Search Path Security
    - Recreate `reset_articles_before_lot_deletion` with SECURITY DEFINER and explicit search_path
    - Recreate `update_articles_on_lot_status_change` with SECURITY DEFINER and explicit search_path
    - Recreate `validate_article_sold_status` with SECURITY DEFINER and explicit search_path
    
  ## Security Notes
    - Adding explicit search_path prevents search_path injection attacks
    - SECURITY DEFINER ensures functions run with creator privileges
    - Foreign key indexes improve query performance and prevent table scans
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_lots_seller_id ON lots(seller_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_default_seller_id ON user_profiles(default_seller_id);

-- Drop unused index
DROP INDEX IF EXISTS idx_user_profiles_custom_persona_id;

-- Fix function security issues by recreating with proper settings

-- 1. Fix reset_articles_before_lot_deletion
DROP TRIGGER IF EXISTS trigger_reset_articles_before_lot_deletion ON lots;
DROP FUNCTION IF EXISTS reset_articles_before_lot_deletion() CASCADE;

CREATE OR REPLACE FUNCTION reset_articles_before_lot_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Reset all articles that reference the deleted lot
  UPDATE articles
  SET
    status = CASE
      WHEN status = 'vendu_en_lot' THEN 'ready'
      ELSE status
    END,
    sold_lot_id = NULL,
    sold_at = CASE
      WHEN status = 'vendu_en_lot' THEN NULL
      ELSE sold_at
    END,
    updated_at = now()
  WHERE sold_lot_id = OLD.id;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_reset_articles_before_lot_deletion
  BEFORE DELETE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION reset_articles_before_lot_deletion();

-- 2. Fix update_articles_on_lot_status_change
DROP TRIGGER IF EXISTS trigger_update_articles_on_lot_status_change ON lots;
DROP FUNCTION IF EXISTS update_articles_on_lot_status_change() CASCADE;

CREATE OR REPLACE FUNCTION update_articles_on_lot_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If the lot status changes to 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    -- Update all articles in the lot
    UPDATE articles
    SET
      status = 'vendu_en_lot',
      sold_lot_id = NEW.id,
      sold_at = NEW.sold_at,
      updated_at = now()
    WHERE id IN (
      SELECT article_id
      FROM lot_items
      WHERE lot_id = NEW.id
    )
    -- Only update articles that are not already sold individually
    AND status NOT IN ('sold', 'vendu_en_lot');

  -- If the lot status changes from 'sold' to something else (sale cancellation)
  ELSIF OLD.status = 'sold' AND NEW.status != 'sold' THEN
    -- Reset articles in the lot to 'ready' status
    UPDATE articles
    SET
      status = 'ready',
      sold_lot_id = NULL,
      sold_at = NULL,
      updated_at = now()
    WHERE sold_lot_id = NEW.id
      AND status = 'vendu_en_lot';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_articles_on_lot_status_change
  AFTER UPDATE ON lots
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_articles_on_lot_status_change();

-- 3. Fix validate_article_sold_status
DROP TRIGGER IF EXISTS trigger_validate_article_sold_status ON articles;
DROP FUNCTION IF EXISTS validate_article_sold_status() CASCADE;

CREATE OR REPLACE FUNCTION validate_article_sold_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If status is vendu_en_lot, sold_lot_id must be set
  IF NEW.status = 'vendu_en_lot' AND NEW.sold_lot_id IS NULL THEN
    RAISE EXCEPTION 'Un article avec le statut vendu_en_lot doit avoir un sold_lot_id';
  END IF;

  -- If sold_lot_id is set, status must be vendu_en_lot
  IF NEW.sold_lot_id IS NOT NULL AND NEW.status != 'vendu_en_lot' THEN
    RAISE EXCEPTION 'Un article avec sold_lot_id doit avoir le statut vendu_en_lot';
  END IF;

  -- If status is vendu_en_lot, sold_price must be NULL or 0
  IF NEW.status = 'vendu_en_lot' AND NEW.sold_price IS NOT NULL AND NEW.sold_price != 0 THEN
    RAISE EXCEPTION 'Un article vendu_en_lot ne doit pas avoir de sold_price (CA porté par le lot)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_article_sold_status
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION validate_article_sold_status();
