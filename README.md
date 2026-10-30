# Budget Foyer

Tableau de bord de gestion du budget familial, **hébergé en ligne sur GitHub Pages**
et sauvegardé dans une base de données **Supabase** (dans le cloud).

- 🌐 **Site en ligne** : gestion des revenus / dépenses, par année et par mois,
  graphiques, budget prévisionnel, catégories personnalisées.
- 🔐 **Accès personnel** : une connexion (email + mot de passe) est requise pour
  consulter et modifier les données. Elles sont stockées dans Supabase et
  protégées (Row Level Security).
- ☁️ **Toujours en ligne** : indépendant du PC, les données vivent dans le cloud.

## 🚀 Déployer / mettre à jour le site

Le site est un **site statique** publié sur **GitHub Pages** depuis la branche `main` :

```bash
git add .
git commit -m "description du changement"
git push origin main
```

GitHub Pages reconstruit automatiquement le site (quelques dizaines de secondes).

## 🔑 Connexion

L'accès est protégé par **Supabase Auth** :
- Email : `dbardreau@gmail.com`
- (mot de passe choisi à la création)

En cas de « session expirée », il suffit de se reconnecter.

## 🗄️ Base de données (Supabase)

- Projet : `https://gcibvyjwxnngbduusccf.supabase.co`
- Table **`kv`** (clé/valeur) : `k` (texte, clé primaire), `v` (JSON), `updated_at`.
- La table et les droits (lecture/écriture réservés aux utilisateurs connectés)
  sont créés par le script SQL (voir `docs_supabase.md` si présent, sinon dans
  l'historique de conversation).
- Les données sont écrites/lues par `app.js` via l'API Supabase (aucun serveur PHP).

### Clés de l'application (dans Supabase)

| Clé        | Contenu |
|------------|---------|
| `base`     | Données de base par année (référence), ex. `2026` |
| `ops`      | Opérations ajoutées manuellement |
| `custom_cats` | Catégories personnalisées |
| `custom_src`  | Sources de revenus personnalisées |
| `subcats`     | Sous-catégories |
| `cats_state`  | Catégories / sources supprimées (et catégorie de regroupement) |

`data.js` sert uniquement de **germe de départ** pour l'année 2026 si la base
est vide.

## Fichiers

| Fichier       | Rôle |
|---------------|------|
| `index.html`  | Structure, onglets, écran de connexion |
| `style.css`   | Thème sombre |
| `app.js`      | Logique, graphiques, saisie, connexion + stockage Supabase |
| `data.js`     | Germe des données 2026 |

> ℹ️ Les anciens fichiers `api.php`, `budget.sql` et `.htaccess` concernaient la
> version locale **WAMP/MySQL** et ne sont plus utilisés par le site en ligne.
