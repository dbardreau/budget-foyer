# Budget Foyer

Tableau de bord de gestion du budget. Tes **ajouts personnels** et les
**données importées** (par année) sont enregistrés dans une **base MySQL**
locale (`budget`) sur ton serveur **WAMP** : plus de dépendance au navigateur,
tes saisies tiennent dans la base même si tu vides les données du navigateur.

## ⚠️ Comment ouvrir le site

Il faut passer par le serveur WAMP (**PHP** + **MySQL**), pas en double-cliquant
sur le fichier. Voir « Installation » ci-dessous.

## Installation (serveur WAMP)

1. **Copie le dossier** `budget` (celui-ci) dans le dossier web de WAMP,
   par exemple `C:\wamp64\www\budget`.
2. **Lance WAMP** et vérifie que l'icône est **verte** (services Apache + MySQL
   démarrés).
3. **Crée la base** : ouvre phpMyAdmin (`http://localhost/phpmyadmin`), onglet
   **SQL**, colle le contenu du fichier `budget.sql`, puis **Exécuter**.
   Cela crée la base `budget` et sa table `kv`.
   > Optionnel : c'est normalement fait automatiquement par `api.php`, mais
   > le faire une fois à la main ne coûte rien.
4. **Ouvre le site** : `http://localhost/budget/` dans ton navigateur.

Le badge en haut à droite doit afficher **« Base de données MySQL — synchronisé »**.

## Configuration de la base (si besoin)

Par défaut, `api.php` se connecte à MySQL avec les paramètres WAMP classiques :
hôte `127.0.0.1`, port `3306`, utilisateur `root`, sans mot de passe. Si tes
identifiants diffèrent, modifie le tableau `$config` en haut de `api.php`.

## Fonctionnalités

- **Plusieurs années** : boutons ‹ › en haut à droite pour naviguer entre les
  années (2026, 2027…). Une année vide est créée automatiquement dès que tu y
  vas ; tu peux ensuite y saisir des opérations. Les données de base d'une
  année sont stockées séparément des ajouts manuels.
- **Accueil** : revenus / dépenses / solde annuels, graphique mensuel, répartition
  des dépenses et top catégories.
- **Mois** : détail de chaque mois (revenus, dépenses par catégorie)
  avec navigation ‹ ›.
- **Budget** : objectif mensuel vs moyenne réelle par catégorie, répartition
  fixes / variables.
- **Graphiques** : évolution des dépenses par grande catégorie, somme restante
  mensuelle, répartition fixe / variable.
- **Catégories** : gère tes catégories de dépenses, tes sources de revenus et
  leurs sous-catégories. Bascule Dépenses / Revenus, ajoute et supprime des
  entrées. Le tout est sauvegardé en base MySQL.
- **Ajouter une opération** : bouton « ＋ Ajouter une opération » pour saisir un
  revenu ou une dépense. Dans l'onglet **Mois**, la section « Vos ajouts manuels »
  permet de **modifier** (✎) ou **supprimer** (Suppr.) chaque opération.
- **Réinitialiser** : supprime les opérations que tu as ajoutées.

## Quelles données vont en MySQL ?

| Donnée                                   | Emplacement      |
|------------------------------------------|------------------|
| Données de base par année (référence)    | base `budget` (clé `base`) |
| Opérations ajoutées manuellement         | base `budget` (clé `ops`)  |
| Catégories & sources personnalisées      | base `budget` (clés `custom_cats`/`custom_src`) |
| Sous-catégories                          | base `budget` (clé `subcats`) |

Les données de base sont stockées dans la base, par année (`base = { "2026": [12 mois], … }`).
Le fichier **`data.js`** sert uniquement de **germe de départ** pour l'année 2026 :
au premier lancement, s'il n'y a pas encore de données en base, elles sont copiées
automatiquement depuis `data.js` vers MySQL (clé `base`, année `2026`). Ensuite
la base fait foi. Tu peux conserver `data.js` en secours.

## Fichiers

| Fichier       | Rôle |
|---------------|------|
| `index.html`  | Structure et onglets |
| `style.css`   | Thème sombre |
| `app.js`      | Logique, graphiques, saisie (lit et écrit la base via `api.php`), navigation multi-années |
| `data.js`     | Germe des données 2026 (utilisé pour la migration initiale) |
| `api.php`     | API PHP : lecture / écriture de la base MySQL |
| `budget.sql`  | Script de création de la base `budget` |
