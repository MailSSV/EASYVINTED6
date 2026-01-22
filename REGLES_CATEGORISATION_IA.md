# Règles de Catégorisation IA - Articles et Lots

## 🎯 Principe Fondamental

L'IA analyse les photos ET les informations que vous fournissez dans le champ **"Infos utiles pour l'IA"**.

**RÈGLE ABSOLUE** : Les informations que VOUS fournissez dans "Infos utiles" sont **PRIORITAIRES** sur l'analyse visuelle.

---

## 📝 Comment utiliser le champ "Infos utiles pour l'IA"

### Emplacement
Dans le formulaire de création d'article, section **"💡 Informations pour l'IA"** :
- Juste après l'upload des photos
- Avant le bouton "Analyser avec l'IA"

### Ce que vous DEVEZ indiquer

Pour **FORCER** la catégorisation correcte, utilisez ces mots-clés :

#### Pour le Genre/Catégorie
```
HOMME → Catégorie "Hommes"
FEMME → Catégorie "Femmes"
GARCON → Catégorie "Garçons"
FILLE → Catégorie "Filles"
ENFANT → Catégorie "Enfants"
BEBE → Catégorie "Bébés"
```

#### Exemples d'utilisation

✅ **BON - Spécifique et clair**
```
T-shirt HOMME taille L, marque Nike, bleu marine
```

✅ **BON - Avec détails**
```
HOMME - Jean slim, taille 42, légère usure aux genoux
```

❌ **MAUVAIS - Trop vague**
```
Beau t-shirt en bon état
```

❌ **MAUVAIS - Sans indication de genre**
```
Taille L, marque Nike
```

---

## 🤖 Comment l'IA Catégorise

### Ordre de Priorité

1. **PRIORITÉ #1** : Vos informations dans "Infos utiles"
   - Si vous écrivez "HOMME", l'IA DOIT catégoriser en "Hommes"
   - Si vous écrivez "FILLE", l'IA DOIT catégoriser en "Filles"

2. **PRIORITÉ #2** : Analyse visuelle des photos
   - Étiquettes visibles
   - Coupe du vêtement
   - Style général

### Règles Appliquées

```javascript
SI "HOMME" dans infos utiles → main_category = "Hommes"
SI "FEMME" dans infos utiles → main_category = "Femmes"
SI "GARCON" dans infos utiles → main_category = "Garçons"
SI "FILLE" dans infos utiles → main_category = "Filles"
SI "ENFANT" dans infos utiles → main_category = "Enfants"
SI "BEBE" dans infos utiles → main_category = "Bébés"
```

---

## 🔍 Vérifier que ça fonctionne

### Test Simple

1. Créez un article avec photos
2. Dans "Infos utiles", écrivez : **"T-shirt HOMME taille L"**
3. Cliquez sur "Analyser avec l'IA"
4. Vérifiez le résultat :
   - **main_category** doit être "Hommes"
   - **sub_category** doit être "Vêtements"
   - **category** doit être "T-shirt"

### Logs de Debug

La fonction Edge affiche dans les logs Supabase :
```
Received usefulInfo: "T-shirt HOMME taille L"
```

Pour voir les logs :
1. Allez sur votre Dashboard Supabase
2. Edge Functions → `analyze-article-image`
3. Onglet "Logs"

---

## 🐛 Dépannage

### L'IA ne respecte pas mes indications

**Cause possible #1** : Le champ "Infos utiles" est vide
- ✅ **Solution** : Remplissez-le avec le genre explicite (HOMME, FEMME, etc.)

**Cause possible #2** : Cache de la fonction Edge
- ✅ **Solution** : Attendez 30 secondes après le déploiement

**Cause possible #3** : Le mot-clé n'est pas reconnu
- ✅ **Solution** : Utilisez EXACTEMENT les mots : HOMME, FEMME, GARCON, FILLE, ENFANT, BEBE

**Cause possible #4** : L'IA Gemini ne respecte pas les instructions
- ✅ **Solution** : Reformulez en mettant le genre EN PREMIER : "HOMME - T-shirt taille L"

---

## 📋 Checklist de Catégorisation Correcte

Pour GARANTIR une catégorisation correcte :

- [ ] J'ai uploadé au moins 1 photo
- [ ] J'ai rempli le champ "Infos utiles pour l'IA"
- [ ] J'ai indiqué le GENRE en majuscules (HOMME, FEMME, etc.)
- [ ] J'ai mis le genre EN PREMIER dans le champ
- [ ] J'ai cliqué sur "Analyser avec l'IA"
- [ ] J'ai vérifié que main_category correspond à mes attentes

---

## 💡 Exemples Complets

### Exemple 1 : T-shirt Homme
```
Champ "Infos utiles" : "HOMME - T-shirt Nike taille L, bleu marine, état neuf"

Résultat attendu :
- main_category: "Hommes"
- sub_category: "Vêtements"
- category: "T-shirt"
- title: "Nike T-shirt bleu marine taille L"
```

### Exemple 2 : Robe Fille
```
Champ "Infos utiles" : "FILLE 8 ans - Robe d'été à fleurs, marque Zara, taille 128"

Résultat attendu :
- main_category: "Filles"
- sub_category: "Vêtements"
- category: "Robe"
- title: "Zara Robe d'été fleurie fille 8 ans"
```

### Exemple 3 : Jean Femme
```
Champ "Infos utiles" : "FEMME - Jean slim noir, taille 38, marque H&M, excellent état"

Résultat attendu :
- main_category: "Femmes"
- sub_category: "Vêtements"
- category: "Jean"
- title: "H&M Jean slim noir taille 38"
```

---

## 🔧 Configuration Technique

### Fonction Edge : `analyze-article-image`

Le paramètre `usefulInfo` est envoyé depuis le frontend :

```typescript
// Frontend (ArticleFormDrawer.tsx)
body: JSON.stringify({
  imageUrls: uploadedPhotoUrls,
  sellerId: sellerIdToUse,
  usefulInfo: formData.useful_info || null,
})
```

### Prompt IA

Le prompt contient cette section prioritaire :

```
⚠️⚠️⚠️ INFORMATIONS DU VENDEUR - PRIORITE ABSOLUE ⚠️⚠️⚠️
${usefulInfo}

🚨 REGLE IMPERIEUSE NON NEGOCIABLE 🚨:
Si le vendeur a indiqué le GENRE, tu DOIS OBLIGATOIREMENT utiliser ces informations.
- Si écrit "HOMME" → main_category = "Hommes"
- Ton analyse visuelle est SECONDAIRE.
```

---

## 📞 Support

Si malgré tout, l'IA ne catégorise pas correctement :

1. Vérifiez les logs de la fonction Edge
2. Copiez-collez le contenu exact du champ "Infos utiles"
3. Partagez la catégorie obtenue vs la catégorie attendue
4. Vérifiez la version déployée de la fonction Edge

**Dernière mise à jour** : 2025-01-18
**Version fonction** : analyze-article-image (avec logs de debug)
