/*
  # Mise à jour automatique des articles quand un lot est vendu

  1. Nouvelle fonctionnalité
    - Crée un trigger qui met automatiquement à jour les articles d'un lot quand celui-ci passe au statut 'sold'
    - Les articles concernés passent au statut 'vendu_en_lot' et leur sold_lot_id est défini

  2. Règles métier
    - Quand un lot passe au statut 'sold', tous ses articles passent à 'vendu_en_lot'
    - Le sold_lot_id est automatiquement défini avec l'ID du lot
    - Si un lot repasse à un autre statut (annulation), les articles repassent à leur statut précédent

  3. Sécurité
    - Le trigger s'exécute avec les droits de l'utilisateur
    - Les politiques RLS existantes s'appliquent
*/

-- Fonction pour mettre à jour les articles quand un lot est vendu
CREATE OR REPLACE FUNCTION update_articles_on_lot_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le lot passe au statut 'sold'
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    -- Mettre à jour tous les articles du lot
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
    -- Ne mettre à jour que les articles qui ne sont pas déjà vendus individuellement
    AND status NOT IN ('sold', 'vendu_en_lot');

  -- Si le lot repasse à un statut différent de 'sold' (annulation de vente)
  ELSIF OLD.status = 'sold' AND NEW.status != 'sold' THEN
    -- Remettre les articles du lot à l'état 'ready'
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
$$ LANGUAGE plpgsql;

-- Créer le trigger sur la table lots
DROP TRIGGER IF EXISTS trigger_update_articles_on_lot_status_change ON lots;
CREATE TRIGGER trigger_update_articles_on_lot_status_change
  AFTER UPDATE OF status ON lots
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_articles_on_lot_status_change();

-- Ajouter un commentaire explicatif
COMMENT ON FUNCTION update_articles_on_lot_status_change() IS
'Met automatiquement à jour le statut des articles à vendu_en_lot quand un lot est vendu, et les restaure quand le lot est annulé';
