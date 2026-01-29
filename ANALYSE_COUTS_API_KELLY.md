# Analyse des Coûts API - Kelly et Fonctionnalités IA

## Résumé Exécutif

Cette analyse détaille tous les appels API Gemini dans l'application EasyVinted, leur déclenchement, et propose des optimisations pour réduire les coûts.

---

## 1. KELLY - Assistant Proactif (KellyProactive.tsx)

### 📊 Comportement Actuel

**DÉCLENCHEMENT AUTOMATIQUE** ✅
- Se déclenche **automatiquement** au chargement de chaque page quand l'utilisateur est connecté
- Code concerné (ligne 108-112 de KellyProactive.tsx) :
```typescript
useEffect(() => {
  if (user && notificationsEnabled) {
    loadInsights();
  }
}, [user, notificationsEnabled]);
```

### 🔄 Fréquence des Appels

**Actuellement :**
- **1 appel API automatique** à chaque chargement de page
- **1 appel API** quand l'utilisateur clique sur "Rafraîchir" (bouton refresh)
- **1 appel API** après chaque action Kelly (création de lot, baisse de prix, etc.) - avec délai de 2s

**Problème Identifié :** L'utilisateur qui navigue entre plusieurs pages déclenche un appel API à chaque navigation !

### 💰 Coût Estimé

**Modèle utilisé :** `gemini-2.5-flash`

**Par appel :**
- Input : ~2000-3000 tokens (résumé de tous les articles du dressing)
- Output : ~500-800 tokens (5 insights max)
- **Coût unitaire estimé :** ~0.001-0.002 €

**Scénarios mensuels :**
- Utilisateur qui navigue 20 fois/jour : **600 appels/mois** = ~0.60-1.20 €/utilisateur
- 100 utilisateurs actifs : **60,000 appels/mois** = ~60-120 €/mois
- 1000 utilisateurs actifs : **600,000 appels/mois** = ~600-1200 €/mois

---

## 2. KELLY CHAT - Assistant Conversationnel (Edge Function)

### 📊 Comportement

**DÉCLENCHEMENT MANUEL** ✅
- Ne se déclenche **QUE** quand l'utilisateur pose une question
- Edge Function : `supabase/functions/kelly-chat/index.ts`

### 💰 Coût Estimé

**Modèle utilisé :** `gemini-2.5-flash`

**Par question :**
- Input : ~500-1000 tokens (contexte article + question)
- Output : ~200-400 tokens (réponse courte, max 200 mots)
- **Coût unitaire estimé :** ~0.0005-0.001 €

**Scénarios mensuels :**
- 5 questions/utilisateur/mois : **500 appels/100 utilisateurs** = ~0.25-0.50 €/mois
- Impact faible ✅

---

## 3. AUTRES FONCTIONNALITÉS IA

### 3.1 Photo Studio - Analyse d'Images (`analyzeProductImage`)

**DÉCLENCHEMENT :** Manuel uniquement (upload d'image)
**Modèle :** `gemini-2.5-flash`
**Coût unitaire :** ~0.002-0.003 € (inclut l'image)
**Impact :** Faible (triggered par utilisateur)

### 3.2 Photo Studio - Édition d'Images (`editProductImage`)

**DÉCLENCHEMENT :** Manuel uniquement (édition avec prompt)
**Modèle :** `imagen-3.0-generate-001`
**Coût unitaire :** ~0.04-0.06 € (génération d'image)
**Impact :** Moyen ⚠️

### 3.3 Optimisation SEO (`optimizeArticleSEO`)

**DÉCLENCHEMENT :**
- Automatique quand Kelly suggère l'action "Optimiser le SEO"
- Dans le formulaire d'article si activé
**Modèle :** `gemini-2.5-flash`
**Coût unitaire :** ~0.001-0.002 €
**Impact :** Moyen

### 3.4 Détecteur de Défauts (`analyzeDefects`)

**DÉCLENCHEMENT :** Manuel (onglet "Défauts" du Photo Studio)
**Modèle :** `gemini-2.5-flash`
**Coût unitaire :** ~0.002-0.003 € (inclut l'image)
**Impact :** Faible

### 3.5 Essayage Virtuel (`generateVirtualTryOn`)

**DÉCLENCHEMENT :** Manuel (onglet "Mannequin" du Photo Studio)
**Modèle :** `imagen-3.0-generate-001`
**Coût unitaire :** ~0.04-0.06 € (génération d'image)
**Impact :** Moyen ⚠️

### 3.6 Analyse de Lots (`generateLotTitleAndDescription`)

**DÉCLENCHEMENT :**
- Automatique lors de la création de lots
- Automatique quand Kelly crée un lot suggéré
**Modèle :** `gemini-2.5-flash`
**Coût unitaire :** ~0.001-0.002 €
**Impact :** Faible

---

## 4. 🎯 RECOMMANDATIONS D'OPTIMISATION

### ✅ PRIORITÉ HAUTE - Kelly Proactive

#### Problème Principal
Kelly génère un appel API **à chaque navigation de page**, ce qui peut devenir très coûteux avec de nombreux utilisateurs.

#### Solution 1 : Cache avec Expiration (RECOMMANDÉ)
```typescript
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

useEffect(() => {
  if (user && notificationsEnabled) {
    const shouldRefresh = !lastRefresh ||
      (Date.now() - lastRefresh.getTime() > CACHE_DURATION);

    if (shouldRefresh) {
      loadInsights();
    }
  }
}, [user, notificationsEnabled]);
```

**Économie estimée :** 80-90% des appels Kelly

#### Solution 2 : Stockage en Base de Données
Stocker les insights dans Supabase avec un timestamp :
- Table `kelly_insights` avec colonne `generated_at`
- Réutiliser les insights si générés il y a moins de 15-30 minutes
- Rafraîchir uniquement si :
  - L'utilisateur clique sur "Rafraîchir"
  - Un article a été modifié/ajouté/vendu
  - 30 minutes se sont écoulées

**Économie estimée :** 90-95% des appels Kelly

#### Solution 3 : Désactiver par Défaut
Afficher Kelly uniquement quand l'utilisateur clique sur son avatar (comportement actuel du bouton réduit).

**Économie estimée :** 95-98% des appels Kelly

### ✅ PRIORITÉ MOYENNE - Édition et Génération d'Images

#### Problème
Les modèles `imagen-3.0-generate-001` sont coûteux (~0.04-0.06 € par génération).

#### Solutions
1. **Ajouter un avertissement de coût** avant génération
2. **Limiter le nombre de générations** par utilisateur/jour (ex: 5 générations/jour max)
3. **Système de crédits** : chaque utilisateur a X crédits/mois
4. **Cache des résultats** : si prompt identique, réutiliser l'image générée

### ✅ PRIORITÉ BASSE - Optimisations Diverses

1. **Batch Processing** : Grouper plusieurs optimisations SEO en un seul appel
2. **Lazy Loading** : Ne charger les fonctionnalités IA que quand nécessaire
3. **Modèles Plus Légers** : Utiliser `gemini-1.5-flash` au lieu de `gemini-2.5-flash` si possible

---

## 5. 📈 ESTIMATION DES COÛTS TOTAUX

### Scénario Actuel (Sans Optimisation)

**100 utilisateurs actifs :**
- Kelly Proactive : 60-120 €/mois
- Kelly Chat : 0.25-0.50 €/mois
- Autres fonctionnalités : 10-20 €/mois
- **TOTAL : 70-140 €/mois**

**1000 utilisateurs actifs :**
- Kelly Proactive : 600-1200 €/mois
- Kelly Chat : 2.50-5 €/mois
- Autres fonctionnalités : 100-200 €/mois
- **TOTAL : 700-1400 €/mois**

### Scénario Optimisé (Avec Cache 15min)

**100 utilisateurs actifs :**
- Kelly Proactive : 6-12 €/mois (-90%)
- Kelly Chat : 0.25-0.50 €/mois
- Autres fonctionnalités : 10-20 €/mois
- **TOTAL : 16-32 €/mois** ✅

**1000 utilisateurs actifs :**
- Kelly Proactive : 60-120 €/mois (-90%)
- Kelly Chat : 2.50-5 €/mois
- Autres fonctionnalités : 100-200 €/mois
- **TOTAL : 162-325 €/mois** ✅

**ÉCONOMIE : 80-85% des coûts totaux !**

---

## 6. 🛠️ PLAN D'ACTION RECOMMANDÉ

### Phase 1 (Immédiat) - Implémentation du Cache
1. Ajouter un système de cache avec expiration (15 minutes)
2. Stocker `lastRefresh` dans localStorage ou state
3. Ne rafraîchir que si cache expiré

### Phase 2 (Court terme) - Base de Données
1. Créer table `kelly_insights` dans Supabase
2. Stocker les insights avec timestamp
3. Invalider cache si changement dans le dressing

### Phase 3 (Moyen terme) - Monitoring
1. Ajouter des métriques de suivi des appels API
2. Dashboard admin pour voir la consommation
3. Alertes si dépassement de seuil

### Phase 4 (Long terme) - Monétisation
1. Système de crédits/abonnement
2. Limite de générations pour free tier
3. Premium pour accès illimité

---

## 7. 📝 CONCLUSION

**Point Principal à Retenir :**
Kelly génère actuellement un appel API **à chaque navigation**, ce qui est le principal coût de l'application. Un simple système de cache avec expiration de 15 minutes permettrait de réduire les coûts de **80-90%**.

**Actions Prioritaires :**
1. ✅ Implémenter le cache pour Kelly (économie immédiate de 80-90%)
2. ⚠️ Limiter les générations d'images (coûteuses)
3. 📊 Ajouter un monitoring des coûts API

**Coût Actuel Estimé (1000 utilisateurs) :** 700-1400 €/mois
**Coût Optimisé Estimé (1000 utilisateurs) :** 162-325 €/mois
**ÉCONOMIE POTENTIELLE :** 540-1075 €/mois (-77%)
