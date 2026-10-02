# Mettre à jour GitHub — mode opératoire (Ordely V10)

Vous avez demandé la mise à jour du dépôt GitHub. **Je ne peux pas la faire à votre place** : cet
environnement ne contient aucun identifiant GitHub (aucun jeton, aucune clé SSH, aucune session
`gh`), et je ne vous demanderai jamais de saisir un mot de passe ou un jeton dans la conversation.
En revanche, **tout est préparé** : l'historique du dépôt d'origine est conservé, il ne reste qu'à
envoyer les fichiers.

Deux chemins possibles. Choisissez selon votre aisance.

---

## Chemin 1 — sans Git, entièrement dans le navigateur (≈ 5 minutes)

C'est le plus simple, et suffisant pour l'essai sur téléphone.

1. Téléchargez **`ordely-pour-github-pages.zip`** et décompressez-le.
2. Ouvrez votre dépôt sur GitHub : `https://github.com/mahdibenayed14-star/ordely`.
3. Cliquez sur **Add file → Upload files**.
4. Glissez-déposez **tous les éléments décompressés** : `index.html`, le dossier `assets/`,
   `demo-data.json`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `README-HEBERGEMENT.md`.
   - Sur macOS, affichez les fichiers cachés avec **⌘ + Maj + .** pour voir `.nojekyll`.
   - Si le dépôt vous propose de **remplacer** `index.html` (l'ancienne V9) : acceptez.
5. Cliquez sur **Commit changes**.
6. Allez dans **Settings → Pages** :
   - si la source est déjà **Deploy from a branch / main / (root)** : rien à faire, attendez 1 à 2 min ;
   - sinon, choisissez cette option et enregistrez.
7. Ouvrez `https://mahdibenayed14-star.github.io/ordely/` sur votre téléphone (Chrome Android ou
   Safari iPhone), puis : **🎙 Tester le micro → ♪ Tester le son → ▶ Démarrer**.

> Cette voie publie **la page de démonstration**. Le serveur Node (mode streaming facultatif) se met
> à jour par le chemin 2, mais il n'est pas nécessaire pour l'essai.

---

## Chemin 2 — avec Git, une seule commande (≈ 10 minutes, mise à jour complète)

Ce chemin met à jour **tout le projet** : la page, le serveur, les tests et la documentation.
L'envoi est une **avance rapide** (le commit V10 est posé sur l'historique d'origine `7a79f13`) :
aucun écrasement, aucun `--force`.

1. Téléchargez **`ordely-pret-a-pousser-git.zip`** et décompressez-le : vous obtenez un dossier
   `ordely-a-pousser` qui contient déjà `git` avec vos commits d'origine.
2. Installez **Git** si nécessaire (https://git-scm.com) — ou utilisez **GitHub Desktop** (voir plus bas).
3. Dans un terminal, placez-vous dans le dossier et lancez :
   ```bash
   bash scripts/pousser-vers-github.sh
   ```
   Le script affiche le commit qui part, ajoute le dépôt distant, puis envoie `main`.
4. Au moment de l'authentification :
   - **Login** : votre identifiant GitHub ;
   - **Password** : un **jeton d'accès personnel**, jamais votre mot de passe.
     Créez-le : GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained
     tokens* → **Generate new token** → accès au dépôt `ordely` avec la permission
     **Contents : Read and write** → copiez le jeton → **révoquez-le après usage**.
5. Le script propose ensuite les étapes suivantes (workflow Pages, adresse, vérification).

### Variante sans terminal : GitHub Desktop

1. **File → Add local repository** → sélectionnez le dossier `ordely-a-pousser`.
2. **Push origin** (GitHub Desktop vous connecte via votre compte, sans jeton à gérer).
3. Puis Settings → Pages comme au point 6 du chemin 1.

---

## Ce que la mise à jour contient

| Changement | Détail |
|---|---|
| Page corrigée | `index.html` (racine) = page autonome mono-fichier ; `public/index.html` = version multi-fichiers |
| Serveur corrigé | `server.js`, `src/server.js`, `src/providers.js` |
| Nouveaux dossiers | `public/assets/`, `tests/`, `e2e/`, `scripts/`, `docs/`, `telephone/` |
| Nouveaux documents | `README.md`, `ETAPES-ESSAI.md`, `JURY_DEMO.md`, `CHECKLIST.md`, `SUIVI-TRAVAIL.md` |
| Publication automatique | `.github/workflows/pages.yml` (déploie `public/` sur GitHub Pages) |
| Déploiement serveur | `render.yaml` (mode streaming facultatif) |

### Fichiers d'origine remplacés ou supprimés (volontairement)

| Ancien fichier | Devient |
|---|---|
| `index.html` (V9) | remplacé par la page V10 (remplacement de contenu) |
| `public/index.html` (V6.1) | remplacé par l'interface corrigée |
| `API_CONTRACT.md`, `ARCHITECTURE.md` (racine) | déplacés et enrichis dans `docs/` |
| `manifest.json` | remplacé par `public/manifest.webmanifest` |
| `sw.js` (racine) | remplacé par `public/sw.js` (cache sûr : interface uniquement) |
| `netlify.toml`, `vercel.json` | supprimés : ils publiaient une page statique au lieu du serveur fourni |
| `Ordely_V6_REAL_TUNISIAN.gitignore` | remplacé par un `.gitignore` fonctionnel |
| `data/database.json` | plus versionné : généré automatiquement depuis `public/demo-data.json` |

Si vous préférez conserver l'un de ces fichiers, dites-le : la suppression est un choix de propreté,
pas une nécessité technique.

---

## Après l'envoi : vérification en une commande

```bash
node scripts/verifier-deploiement.mjs https://mahdibenayed14-star.github.io/ordely/
```

- Sur **GitHub Pages**, le script détecte un site statique et contrôle : page, `assets/`,
  `demo-data.json`, contexte HTTPS → **10/10 attendu**.
- Sur **Render / serveur Node**, il contrôle en plus l'API et le démarrage vocal réel en français
  et en derja → **6/6 attendu**.

---

## Si quelque chose bloque

| Symptôme | Cause | Solution |
|---|---|---|
| `Authentication failed` | Mot de passe utilisé à la place d'un jeton | Créez un jeton d'accès personnel (permission *Contents: Read and write*) et utilisez-le |
| `Support for password authentication was removed` | GitHub n'accepte plus les mots de passe | Idem : jeton, ou GitHub Desktop |
| `Updates were rejected… non-fast-forward` | Le dépôt distant a reçu d'autres commits | `git pull --rebase origine main` puis relancez le script |
| Pages reste en 404 | Publication non activée ou délai | **Settings → Pages** : activez la source, attendez 2 min, rechargez |
| La page affiche l'ancienne version | Cache du navigateur | **Recharger la dernière version** dans la page, ou `Ctrl/Cmd + Shift + R` |
| Le site s'affiche sans style | `assets/` non envoyé | Renvoyez le dossier `assets/` **avec** `index.html` (ou publiez la page mono-fichier) |

---

## Rappel : la démo est déjà accessible sans rien publier

Le panneau **Live Preview** de cette conversation ouvre la démo en cours d'exécution
(étiquette « Ordely — démo vocale gratuite »). Le micro y est bloqué dans le cadre d'aperçu :
cliquez sur le bandeau **« Ouvrir l'application ↗ »** pour obtenir un onglet normal.
La publication GitHub sert à obtenir une adresse **permanente et partageable** — utile pour la
démonstration devant le jury.
