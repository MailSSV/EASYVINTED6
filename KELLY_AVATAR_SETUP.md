# Configuration de l'avatar de Kelly

Pour personnaliser l'apparence de Kelly, votre coach IA, suivez ces étapes :

## Placement de l'image

1. Placez votre image de Kelly dans le dossier `/public` du projet
2. Renommez l'image en `kelly-avatar.png`
3. L'image sera automatiquement affichée dans :
   - Le header de la modale Kelly (en haut)
   - Le bouton minimisé de Kelly (en bas à droite)

## Spécifications recommandées

- **Format** : PNG, JPG ou WEBP
- **Dimensions** : Carré (ex: 200x200px, 400x400px)
- **Poids** : < 100 Ko pour des performances optimales
- **Style** : Portrait ou avatar avec fond uni ou transparent

## Fallback

Si l'image n'est pas trouvée ou ne peut pas être chargée, l'icône Bot par défaut sera affichée automatiquement.

## Emplacement du fichier

```
/project
  /public
    kelly-avatar.png  ← Placez votre image ici
  /src
  /dist
  ...
```

L'image que vous avez fournie (la coach IA blonde avec un casque) est parfaite pour cet usage !
