# 🚀 Guide Git — Publier les modifications sur GitHub

Bienvenue ! Ce guide t'explique, étape par étape, comment publier
les modifications de ton site sur GitHub.

## 📖 Vocabulaire rapide

| Terme | Ce que ça veut dire |
|---|---|
| **Dépôt local** | Ton dossier sur cet ordinateur (`D:\PROJET IA\budget`) |
| **GitHub** | Le dépôt en ligne (le « cloud » de ton code) |
| **Commit** | Enregistrer une modification (une « photo » de ton code) |
| **Push** | Envoyer les modifications sur GitHub |
| **Pull** *(rarement utile pour toi)* | Récupérer les modifications depuis GitHub |

---

## ✏️ Les 3 commandes magiques

Chaque fois que tu modifies ton code et que tu veux le mettre en ligne,
tu fais ces 3 commandes, dans l'ordre :

### 1️⃣ `git add .`
> Dira à Git : « prends en compte tous mes changements ».

### 2️⃣ `git commit -m "message"`
> Dira à Git : « enregistre ces changements, avec ce petit message
> qui décrit ce que j'ai fait ».

### 3️⃣ `git push`
> Dira à Git : « envoie tout ça sur GitHub ».

---

## 💻 Comment faire dans la pratique

1. Ouvre un **PowerShell** dans ton dossier :
   - Clique droit dans le dossier `budget` → **« Ouvrir dans le terminal »**
   - ou bien, dans PowerShell : `cd "D:\PROJET IA\budget"`

2. Lance les 3 commandes l'une après l'autre :

```powershell
git add .
git commit -m "J'ai modifié mon site"
git push
```

3. Si tout se passe bien, tu verras un message qui indique que c'est envoyé ✅

---

## ✍️ Bien écrire le message de commit

Remplace `"J'ai modifié mon site"` par un message **clair et court** qui décrit
ce que tu as changé. Exemples utiles :

```powershell
git commit -m "Ajout de la colonne budget 2026"
git commit -m "Correction du bug d'affichage des dépenses"
git commit -m "Amélioration du style des tableaux"
```

---

## 🔍 Les commandes utiles pour vérifier

```powershell
git status
```
> Montre ce qui a changé dans ton dossier (fichiers modifiés, ajoutés...).
> C'est la commande « jete un œil avant de publier ».

```powershell
git log --oneline
```
> Montre l'historique de tes publications (les commits précédents).

---

## ⚠️ Les points à retenir

- **`INFOS_BUDGET_FOYER.md`** : ce fichier (tes notes internes avec les identifiants)
  est automatiquement **exclu** de l'envoi. ❌ Il ne doit jamais être publié.

- **`git push` peut refuser** si quelque chose a changé sur GitHub pendant que tu
  travaillais. Si ça t'arrive, pas de panique : envoie-moi le message affiché,
  je t'aiderai.

- Si ton site en ligne **ne change pas** juste après le push, c'est normal :
  selon l'hébergement, la mise à jour peut prendre quelques minutes.
  (Vérifie aussi que ton hébergement se met bien à jour depuis la branche `main`.)

---

## 🧾 Le récap en une image

```
Ton dossier (local)  ──git push──▶  GitHub  ──▶  Ton site en ligne
     (tu modifies)                          (se met à jour)
```

Tu modifies ici → tu envoies sur GitHub → ton site prend le relais. C'est tout ! 🎉
