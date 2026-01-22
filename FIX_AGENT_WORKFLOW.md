# Fix Agent Workflow - Status Update Problem

## Problème identifié

Le bouton "Start Run" dans l'interface `/agent-optimized-view` ne peut pas mettre à jour le statut de "ready" à "processing" car la contrainte de base de données `articles_status_check` ne contient pas les valeurs "processing" et "error".

### Cause

La migration `20260110234531_add_reserved_status.sql` a accidentellement supprimé les statuts "processing" et "error" de la contrainte CHECK.

## Solution

### Étape 1: Corriger la contrainte de base de données

Exécutez ce SQL dans votre Supabase SQL Editor:

```sql
-- Fix articles table constraint
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN (
    'draft',
    'ready',
    'scheduled',
    'published',
    'vinted_draft',
    'sold',
    'vendu_en_lot',
    'reserved',
    'processing',
    'error'
  ));

-- Fix lots table constraint
ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_status_check;
ALTER TABLE lots ADD CONSTRAINT lots_status_check
  CHECK (status IN (
    'draft',
    'ready',
    'scheduled',
    'published',
    'vinted_draft',
    'sold',
    'processing',
    'error'
  ));
```

### Étape 2: Tester le workflow

Après avoir appliqué la migration SQL ci-dessus, exécutez:

```bash
npm run tsx scripts/testAgentWorkflow.ts
```

Vous devriez voir:

```
✅ ✅ ✅ WORKFLOW TEST PASSED! ✅ ✅ ✅
The 'Start Run' button correctly updates status from 'ready' to 'processing'
```

### Étape 3: Vérifier dans l'interface

1. Ouvrez `http://localhost:5173/agent-optimized-view`
2. Sélectionnez un article avec le statut "ready"
3. Cliquez sur "START RUN" (ou appuyez sur la touche `S`)
4. Vérifiez que:
   - Le toast affiche "RUN STARTED ✓"
   - Le badge de statut passe à "PROCESSING" avec animation pulse
   - L'étape workflow passe à l'étape 2 (Copy Title)

## Améliorations apportées au code

Le fichier `src/pages/AgentOptimizedView.tsx` a été mis à jour avec:

1. **Meilleure gestion d'erreurs** dans `handleStartRun()`:
   - Vérification que l'item est sélectionné
   - Vérification que le statut est bien "ready"
   - Messages d'erreur explicites
   - Logs console pour debugging

2. **Feedback amélioré**:
   - `.select()` ajouté à la requête pour confirmer l'update
   - Vérification que des lignes ont été modifiées
   - Mise à jour immédiate de l'état local avant refresh
   - Toast avec symbole de confirmation (✓)

3. **Logs de debugging**:
   - Tous les logs sont préfixés avec `[AGENT]`
   - Affichage de l'ID et du statut actuel
   - Confirmation de l'update réussie

## Statuts disponibles

### Pour les articles (articles table)

- `draft` - Brouillon en cours de création
- `ready` - Prêt à être publié
- `scheduled` - Programmé pour publication future
- `processing` - En cours de traitement par l'agent
- `published` - Publié sur Vinted
- `vinted_draft` - Sauvegardé comme brouillon sur Vinted
- `sold` - Vendu
- `vendu_en_lot` - Vendu dans un lot
- `reserved` - Réservé pour un lot
- `error` - Erreur lors du traitement

### Pour les lots (lots table)

- `draft` - Brouillon en cours de création
- `ready` - Prêt à être publié
- `scheduled` - Programmé pour publication future
- `processing` - En cours de traitement par l'agent
- `published` - Publié sur Vinted
- `vinted_draft` - Sauvegardé comme brouillon sur Vinted
- `sold` - Vendu
- `error` - Erreur lors du traitement

## Prochaines étapes

Une fois la contrainte corrigée, le workflow d'automatisation complet pourra être testé et l'agent IA pourra:

1. Démarrer l'exécution (statut: ready → processing)
2. Copier les données (titre, description, prix, photos)
3. Interagir avec Vinted pour créer l'annonce
4. Sauvegarder l'URL Vinted
5. Marquer comme "vinted_draft" ou "published"
6. Passer à l'article suivant automatiquement
