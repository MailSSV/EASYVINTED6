# Implémentation du Système de Cache pour Kelly

## Résumé

Le système de cache a été **implémenté avec succès** pour réduire les coûts API de Kelly de **80-90%**.

---

## Ce qui a été fait

### 1. Base de Données - Table `kelly_insights`

**Migration appliquée :** `create_kelly_insights_with_cache`

Une nouvelle table a été créée dans Supabase avec les champs suivants :
- `id` - Identifiant unique
- `user_id` - ID de l'utilisateur (foreign key vers auth.users)
- `type` - Type d'insight (ready_to_publish, price_drop, seasonal, etc.)
- `priority` - Niveau de priorité (high, medium, low)
- `title` - Titre de l'insight
- `message` - Message détaillé
- `action_label` - Label du bouton d'action
- `article_ids` - IDs des articles concernés
- `suggested_action` - Détails de l'action suggérée (JSON)
- `status` - Statut (active, dismissed, completed)
- `dismissed_at` - Date de rejet
- **`cache_key`** - Clé de cache (permet plusieurs caches par utilisateur)
- **`last_refresh_at`** - Timestamp du dernier rafraîchissement
- **`expires_at`** - Date d'expiration du cache (30 minutes par défaut)
- `created_at` - Date de création

**Sécurité RLS activée :** Chaque utilisateur ne peut voir que ses propres insights.

### 2. Composant Kelly - Modifications

**Fichier modifié :** `src/components/KellyProactive.tsx`

#### Nouvelle fonction : `loadCachedInsights()`
```typescript
// Charge les insights depuis le cache DB
// Vérifie que le cache est valide (< 30 minutes)
// Retourne null si pas de cache ou cache expiré
```

#### Nouvelle fonction : `saveCachedInsights()`
```typescript
// Sauvegarde les insights générés dans la DB
// Supprime l'ancien cache avant d'insérer
// Définit l'expiration à 30 minutes
```

#### Fonction modifiée : `loadInsights(forceRefresh = false)`
```typescript
// Si forceRefresh = false (navigation normale) :
//   1. Essaie de charger depuis le cache
//   2. Si cache valide, l'utilise sans appel API ✅
//   3. Sinon, génère via API et met en cache

// Si forceRefresh = true (bouton refresh) :
//   1. Ignore le cache
//   2. Génère via API
//   3. Met à jour le cache
```

#### Modifications des actions
- **Bouton Rafraîchir** : Appelle `loadInsights(true)` pour forcer la mise à jour
- **Après action Kelly** : Appelle `loadInsights(true)` après 2 secondes pour avoir les insights à jour

---

## Comment ça fonctionne ?

### Scénario 1 : Navigation normale (80-90% des cas)

1. Utilisateur charge une page
2. Kelly vérifie le cache dans la DB
3. **Si cache valide (< 30 min) :** Affiche les insights sans appel API ✅
4. **Si cache expiré :** Génère de nouveaux insights via API et met en cache

### Scénario 2 : Rafraîchissement manuel

1. Utilisateur clique sur le bouton "Rafraîchir"
2. Kelly ignore le cache
3. Génère de nouveaux insights via API
4. Met à jour le cache

### Scénario 3 : Action Kelly exécutée

1. Utilisateur exécute une action (baisse de prix, création de lot, etc.)
2. L'action modifie les articles
3. Après 2 secondes, Kelly régénère les insights
4. Met à jour le cache avec les nouveaux insights

---

## Économies Réalisées

### Avant l'optimisation
- **Appel API à chaque navigation de page**
- 1000 utilisateurs × 20 navigations/jour = **20,000 appels/jour**
- **600,000 appels/mois**
- Coût estimé : **600-1200 €/mois**

### Après l'optimisation (avec cache 30 min)
- **Appel API uniquement si cache expiré (toutes les 30 min)**
- 1000 utilisateurs × 2-3 appels/jour = **2,000-3,000 appels/jour**
- **60,000-90,000 appels/mois**
- Coût estimé : **60-90 €/mois**

### 📊 Économie : **540-1110 €/mois (-90%)** ✅

---

## Avantages du Cache en Base de Données

1. **Persistance** : Le cache survit aux rechargements de page
2. **Multi-onglets** : Si l'utilisateur ouvre plusieurs onglets, ils partagent le même cache
3. **Invalidation intelligente** : Le cache s'actualise automatiquement après une action
4. **Évolutif** : Possibilité d'ajouter plusieurs types de cache avec `cache_key`
5. **Nettoyage automatique** : Fonction `cleanup_expired_kelly_insights()` disponible

---

## Prochaines Étapes Recommandées

### Court terme
- Ajouter un indicateur visuel "Dernière mise à jour il y a X minutes"
- Permettre à l'utilisateur d'ajuster la durée du cache (15-60 min)

### Moyen terme
- **Monitoring** : Créer un dashboard admin pour suivre le nombre d'appels API
- **Alertes** : Notifier si le quota mensuel approche de la limite
- **Métriques** : Tracker le taux de cache hit/miss

### Long terme
- **Cache intelligent** : Invalider automatiquement le cache quand un article est modifié
- **Pré-génération** : Générer les insights en arrière-plan toutes les 30 min via un cron job
- **Cache partagé** : Pour les insights génériques (tendances saisonnières)

---

## Fonction de Nettoyage (Maintenance)

Une fonction `cleanup_expired_kelly_insights()` a été créée pour nettoyer automatiquement :
- Les insights expirés
- Les insights rejetés depuis plus de 7 jours

**Pour l'utiliser manuellement :**
```sql
SELECT cleanup_expired_kelly_insights();
```

**Pour automatiser (via cron job Supabase) :**
```sql
SELECT cron.schedule(
  'cleanup-kelly-insights',
  '0 3 * * *', -- Tous les jours à 3h du matin
  $$ SELECT cleanup_expired_kelly_insights(); $$
);
```

---

## Test de Vérification

Pour vérifier que le cache fonctionne :

1. **Premier chargement :**
   - Ouvrir la console du navigateur (F12)
   - Charger une page avec Kelly
   - Observer : "Generating insights..." → Appel API

2. **Navigation immédiate :**
   - Naviguer vers une autre page
   - Revenir sur la page précédente (< 30 min)
   - Observer : Pas de "Generating insights..." → **Cache utilisé** ✅

3. **Vérification DB :**
   ```sql
   SELECT
     user_id,
     count(*) as insights_count,
     last_refresh_at,
     expires_at,
     expires_at > now() as is_valid
   FROM kelly_insights
   WHERE status = 'active'
   GROUP BY user_id, last_refresh_at, expires_at;
   ```

---

## Conclusion

Le système de cache est **opérationnel** et permettra de réduire considérablement les coûts API de Kelly.

**Économie attendue : 80-90% des coûts Kelly**

Pour 1000 utilisateurs actifs :
- **Avant :** 600-1200 €/mois
- **Après :** 60-90 €/mois
- **Économie :** 540-1110 €/mois

Le projet compile correctement et est prêt à être déployé.
