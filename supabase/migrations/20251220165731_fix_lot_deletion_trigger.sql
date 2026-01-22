/*
  # Correction de la suppression des lots vendus

  ## Description
  Ajoute un trigger BEFORE DELETE sur les lots pour réinitialiser automatiquement
  les articles associés avant la suppression du lot. Cela évite les conflits avec
  le trigger de validation du statut des articles.

  ## Problème résolu
  Quand un lot vendu est supprimé :
  - La contrainte ON DELETE SET NULL met sold_lot_id à NULL
  - MAIS le statut reste 'vendu_en_lot'
  - Le trigger de validation bloque car un article 'vendu_en_lot' doit avoir un sold_lot_id

  ## Solution
  Avant de supprimer un lot, on réinitialise les articles à leur statut précédent :
  - Si l'article était 'vendu_en_lot', il repasse à 'ready'
  - Le sold_lot_id est mis à NULL
  - Le sold_at est réinitialisé

  ## Important
  - Ce trigger s'exécute AVANT la suppression du lot
  - Les articles ne sont PAS supprimés, seulement réinitialisés
  - Les politiques RLS existantes s'appliquent
*/

-- Fonction pour réinitialiser les articles avant la suppression d'un lot
CREATE OR REPLACE FUNCTION reset_articles_before_lot_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Réinitialiser tous les articles qui font référence au lot supprimé
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
$$ LANGUAGE plpgsql;

-- Créer le trigger sur la table lots
DROP TRIGGER IF EXISTS trigger_reset_articles_before_lot_deletion ON lots;
CREATE TRIGGER trigger_reset_articles_before_lot_deletion
  BEFORE DELETE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION reset_articles_before_lot_deletion();

-- Ajouter un commentaire explicatif
COMMENT ON FUNCTION reset_articles_before_lot_deletion() IS
'Réinitialise automatiquement les articles associés avant la suppression d''un lot pour éviter les conflits de validation';