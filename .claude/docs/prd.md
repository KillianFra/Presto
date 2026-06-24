# Presto — Cahier des charges produit

> Transforme tes photos d'annonces en visuels professionnels en quelques secondes.

---

## 1. Vision du produit

**Presto** est un SaaS web permettant à des particuliers français de transformer automatiquement leurs photos d'annonces grâce à l'IA — sans compétence technique, sans logiciel, sans photographe.

La promesse : uploader une photo, choisir une transformation, télécharger un visuel professionnel. En moins de 60 secondes.

---

## 2. Problème adressé

Les particuliers qui publient des annonces sur Leboncoin, SeLoger, PAP ou similaires prennent des photos de mauvaise qualité : mauvais éclairage, fond encombré, perspective déformée, pièces vides ou mal meublées. Résultat : leurs annonces sont moins vues, moins cliquées, et leur bien se vend ou se loue moins vite et moins cher.

Les solutions existantes (photographes, home stagers) sont chères, lentes et inaccessibles aux particuliers.

---

## 3. Cible utilisateur

- **Profil** : Particuliers, 35-50 ans
- **Plateformes cibles** : Leboncoin, SeLoger, PAP, Airbnb, Booking
- **Cas d'usage principaux** :
  - Vente ou location d'un bien immobilier
  - Vente d'objets ou meubles (Leboncoin, Facebook Marketplace)
- **Niveau technique** : faible à moyen — l'interface doit être ultra-simple

---

## 4. Périmètre du MVP

### 4.1 Plateforme
- Web uniquement (responsive mobile)

### 4.2 Authentification
- Inscription / connexion par email + mot de passe
- Réinitialisation de mot de passe par email


### 4.3 Verticale Immobilier
 
Cible : particuliers qui vendent ou louent un bien sur SeLoger, PAP, Leboncoin, Airbnb, Booking.
 
| Transformation                       | Description                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Amélioration lumière / contraste** | Correction automatique de l'exposition, luminosité, balance des blancs                                    |
| **Virtual staging**                  | Ajout automatique de meubles et déco dans une pièce vide — styles : moderne, scandinave, cosy, industriel |
| **Suppression d'objets gênants**     | Effacement d'éléments indésirables (cartons, câbles, désordre, meubles trop personnels...)                |
| **Redressement de perspective**      | Correction des lignes déformées (grand angle, photo prise de biais)                                       |
| **Changement de cadrage**            | Recadrage intelligent pour optimiser la composition de la pièce                                           |
 
**Logique de prompt immobilier :**
Le LLM analyse la photo et détecte le type de pièce (salon, chambre, cuisine, salle de bain, extérieur), la luminosité, le style existant et les volumes. Il génère un prompt de staging qui respecte l'architecture réelle de la pièce sans en modifier les proportions.

### 4.4 Verticale Objets
 
Cible : particuliers qui vendent des objets, meubles, appareils sur Leboncoin, Facebook Marketplace.
 
| Transformation                  | Description                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Fond propre / neutre**        | Suppression de l'arrière-plan et remplacement par un fond blanc, gris clair ou épuré façon studio         |
| **Mise en situation lifestyle** | Placement de l'objet dans un contexte réaliste selon son type : cuisine, salon, bureau, extérieur, nature |
 
**Logique de prompt objets :**
Le LLM identifie automatiquement le type d'objet (meuble, électroménager, vélo, outil...) et propose des mises en situation cohérentes : un canapé dans un salon, un vélo en extérieur, un appareil électro dans une cuisine. L'utilisateur affine via une suggestion ou un mini prompt libre. Le prompt généré se concentre sur la mise en scène sans modifier la forme, les couleurs ni les dimensions de l'objet.

### 4.5 Gestion des projets

Création d'un projet par annonce
Upload de photo(s) par projet
Choix du type d'annonce (immobilier / objet)
Historique des projets
Visualisation avant / après (slider)
Téléchargement de la photo HD
Régénération du résultat

---

## 5. Stack technique

### Frontend
- **React** (Vite)
- **Tailwind CSS**

### Backend
- **Express.js** (API REST)
- **PostgreSQL + Prisma** (base de données)

### IA Pipeline

```
Photo entrée + intention utilisateur (mini prompt ou suggestion IA)
    ↓
1. Analyse de la photo — Vision LLM (ex: GPT-4o / Claude)
   → détecte le type de pièce / objet, la luminosité, le style actuel,
     les éléments présents, les volumes et perspectives
    ↓
2. Génération du prompt interne — LLM
   → à partir de l'analyse + de la demande utilisateur,
     génère un prompt optimisé pour le modèle de génération d'image
    ↓
3. Appel au modèle de génération d'image — Fal.ai / Replicate
   → image de référence (img2img / inpainting) + prompt généré
   → le modèle respecte la structure et les volumes de la photo originale
    ↓
4. Retour et affichage
   → image générée stockée sur R2
   → affichage avant / après côté client
```

**LLM analyse + prompt** : GPT ou Claude (à tester en fonction des résultats sur analyse d'image et qualité de prompt généré - low cost et rapidité sont des critères clés)
**Génération image** : gpt-image-2
**Stockage** : supabase bucket

---

## 6. Points de vigilance



- **RGPD** : suppression automatique des photos originales après 30 jours, politique de confidentialité claire
- **Mentions légales** : toute image transformée doit être indiquée "simulation IA" sur les annonces immobilières (obligation déontologique)
- **Qualité IA** : ne pas sur-promettre — les résultats sur photos très sombres ou très floues seront limités
- **Coûts GPU** : surveiller le coût par génération, passer en self-hosted dès que le volume le justifie

