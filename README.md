# Budget Foyer 2026

Tableau de bord local de gestion du budget, préchargé avec les données du fichier
`compte 2026.ods`.

## Ouvrir le site

Double-clique simplement sur **`index.html`** : tout fonctionne localement dans le
navigateur, sans serveur ni connexion.

## Fonctionnalités

- **Accueil** : revenus / dépenses / solde annuels, graphique mensuel, répartition
  des dépenses et top catégories.
- **Mois** : détail de chaque mois (revenus, dépenses par catégorie)
  avec navigation ‹ ›.
- **Budget** : objectif mensuel vs moyenne réelle par catégorie, répartition
  fixes / variables.
- **Graphiques** : évolution des dépenses par grande catégorie, somme restante
  mensuelle, répartition fixe / variable.
- **Catégories** (onglet dédié) : gère tes **catégories de dépenses**, tes
  **sources de revenus** et leurs **sous-catégories**. Bascule Dépenses / Revenus,
  ajoute une nouvelle catégorie ou source, et ajoute des sous-catégories à chaque
  entrée (avec suppression individuelle). Le tout est sauvegardé dans le navigateur.
- **Ajouter une opération** : bouton « ＋ Ajouter une opération » pour saisir un
  revenu ou une dépense (catégorie, sous-catégorie optionnelle, libellé, montant).
  Les saisies sont conservées dans le navigateur (localStorage) et réapparaissent
  à chaque ouverture. Dans l'onglet **Mois**, la section « Vos ajouts manuels »
  permet de **modifier** (✎ Modifier) ou **supprimer** (Suppr.) chaque opération.
- **Réinitialiser** : supprime les opérations que tu as ajoutées.

## Fichiers

| Fichier     | Rôle |
|-------------|------|
| `index.html`| Structure et onglets |
| `style.css` | Thème sombre |
| `app.js`    | Logique, graphiques, saisie (données budgétaires incluses) |
| `data.js`   | Données 2026 importées depuis `compte 2026.ods` (ne pas modifier) |
| `supabase.config.js` | Identifiants de la base en ligne (à compléter) |

## Données brutes

Pour réimporter les données depuis `compte 2026.ods`, voir le dossier
`%TEMP%\opencode\ods_extract` (parser PowerShell `tojson.ps1`).

---

# Guide : mettre ton budget en ligne (consulter + saisir partout)

Objectif : héberger le site sur **GitHub Pages** (accessible par une adresse web)
et stocker tes **ajouts manuels** dans une base **Supabase** (synchro dans le cloud),
pour les retrouver depuis le téléphone ou un autre ordinateur.

> Tes données de base restent dans `data.js`. Seuls tes **ajouts manuels** sont
> synchronisés en ligne (comme avant, mais dans le cloud au lieu du navigateur).

## Étape 2 — Créer le dépôt GitHub et héberger le site

1. Va sur https://github.com et connecte-toi.
2. Clique sur **« + »** en haut à droite → **« New repository »**.
3. Nomme-le (ex. `budget-foyer`), laisse **Public** ou choisis **Private**
   (recommandé pour tes données), **ne coche pas** « Add a README » (tu en as déjà un).
   Clique sur **« Create repository »**.
4. Sur la page suivante, il faut **déposer les fichiers** de ce dossier :
   `index.html`, `style.css`, `app.js`, `data.js`, `supabase.config.js`, `README.md`.
   - La plus simple : clique sur **« uploading an existing file »**, glisse-dépose
     les fichiers, puis **« Commit changes »**.
5. Active l'hébergement : onglet **Settings** → **Pages** → **Source** :
   choisis la branche `main` et le dossier `/ (root)` → **Save**.
6. GitHub te donne une adresse du type `https://tonpseudo.github.io/budget-foyer/`.
   Patientez 1-2 min, puis ton site est **consultable de partout** à cette adresse.

> Pour consulter tes données, ouvre l'adresse GitHub Pages (pas le fichier local).

## Étape 3 — Créer la base Supabase

1. Va sur https://supabase.com et connecte-toi (ouvre un compte gratuit).
2. Clique sur **« New project »**, choisis un nom, un mot de passe de base
   (à noter), et une région proche de chez toi → **Create new project**.
3. Une fois le projet créé, ouvre **SQL Editor** dans le menu de gauche, colle le
   script ci-dessous, puis clique sur **« Run »** (cela prépare la table de données) :

```sql
create table if not exists public.user_data (
  id bigint primary key default 1,
  data jsonb not null default '{}'::jsonb
);
insert into public.user_data (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

alter table public.user_data enable row level security;
-- Politique ouverte pour un usage familial simple :
create policy "tous" on public.user_data for all using (true) with check (true);
```

4. Toujours dans Supabase : menu **Project Settings** → **API**.
   Copie :
   - **Project URL** (ex. `https://xxxx.supabase.co`)
   - **anon public key** (longue chaîne `eyJ...`)
5. Sur GitHub, ouvre le fichier `supabase.config.js`, clique sur l'icône **stylo
   (crayon)** pour l'éditer, colle l'URL et la clé entre les guillemets, puis
   **Commit changes**.

Une fois la page GitHub Pages mise à jour (1-2 min), ton budget est complet et
**synchronisé partout** : tu peux ajouter ou modifier des opérations depuis
n'importe quel appareil, tout est conservé dans la base en ligne.

### Notes
- Le badge en haut à droite indique l'état de la synchronisation
  (« Stockage local navigateur » = base non configurée, « Synchronisé » = en ligne).
- Si la base est momentanément injoignable, tes ajouts sont conservés dans le
  navigateur et remontés dès que la connexion revient.
- Si tu ne configure pas de base, l'application fonctionne comme avant (locale).

