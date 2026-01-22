/*
  # Ajout de la colonne sold_lot_id aux articles

  1. Modifications
    - Ajoute la colonne `sold_lot_id` aux articles pour tracer le lot de vente
    - Ajoute la contrainte de clé étrangère vers la table lots
    - Crée un index pour améliorer les performances
    - Ajoute les fonctions de validation de cohérence

  2. Nouveaux champs
    - `sold_lot_id` (uuid nullable) : ID du lot qui a vendu l'article

  3. Règles métier
    - Un article vendu_en_lot doit avoir un sold_lot_id
    - Un article avec sold_lot_id doit avoir le statut vendu_en_lot
    - Un article vendu_en_lot ne doit pas avoir de sold_price individuel

  4. Sécurité
    - Les politiques RLS existantes s'appliquent automatiquement
*/

-- Ajouter la colonne sold_lot_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = 'sold_lot_id'
  ) THEN
    ALTER TABLE articles ADD COLUMN sold_lot_id uuid;
    
    -- Ajouter la contrainte de clé étrangère
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lots') THEN
      ALTER TABLE articles
      ADD CONSTRAINT articles_sold_lot_id_fkey
      FOREIGN KEY (sold_lot_id) REFERENCES lots(id) ON DELETE SET NULL;
    END IF;

    -- Créer un index pour améliorer les performances
    CREATE INDEX IF NOT EXISTS idx_articles_sold_lot_id ON articles(sold_lot_id);
    
    -- Ajouter un commentaire explicatif
    COMMENT ON COLUMN articles.sold_lot_id IS 'ID du lot dans lequel cet article a été vendu (si vendu_en_lot)';
  END IF;
END $$;

-- Créer une fonction pour valider la cohérence du statut
CREATE OR REPLACE FUNCTION validate_article_sold_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut est vendu_en_lot, sold_lot_id doit être renseigné
  IF NEW.status = 'vendu_en_lot' AND NEW.sold_lot_id IS NULL THEN
    RAISE EXCEPTION 'Un article avec le statut vendu_en_lot doit avoir un sold_lot_id';
  END IF;

  -- Si sold_lot_id est renseigné, le statut doit être vendu_en_lot
  IF NEW.sold_lot_id IS NOT NULL AND NEW.status != 'vendu_en_lot' THEN
    RAISE EXCEPTION 'Un article avec sold_lot_id doit avoir le statut vendu_en_lot';
  END IF;

  -- Si le statut est vendu_en_lot, sold_price doit être NULL ou 0
  IF NEW.status = 'vendu_en_lot' AND NEW.sold_price IS NOT NULL AND NEW.sold_price != 0 THEN
    RAISE EXCEPTION 'Un article vendu_en_lot ne doit pas avoir de sold_price (CA porté par le lot)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour valider la cohérence
DROP TRIGGER IF EXISTS validate_article_sold_status_trigger ON articles;
CREATE TRIGGER validate_article_sold_status_trigger
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION validate_article_sold_status();
