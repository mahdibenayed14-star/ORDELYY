# Étapes à faire pour l’essai

## 0. Lancer tout de suite (sans rien installer)

Une démo est **déjà en cours d’exécution** dans votre espace de travail : ouvrez le panneau
**Live Preview** (à droite de cette conversation, étiquette « Ordely — démo vocale gratuite »).
Ce lien est protégé par un jeton propre à votre navigateur, c’est pourquoi il faut passer par ce
panneau et non par une adresse recopiée à la main.

- La page s’affiche dans un cadre : **le microphone y est bloqué par sécurité**. Dans la page,
  un bandeau jaune propose **« Ouvrir l’application ↗ »** : cliquez dessus pour obtenir l’onglet
  normal, où le micro fonctionne.
- Ce lien reste actif **tant que l’espace de travail est ouvert**. Pour un lien permanent sur votre
  propre compte (GitHub Pages, gratuit), faites la partie A ci-dessous : 5 minutes, une seule fois.

Deux essais possibles. Faites d’abord l’**essai téléphone** : c’est celui qui répond à votre
demande (gratuit, ouvrable sur votre téléphone, HTTPS).

---

## A. Essai sur téléphone, gratuit, via GitHub Pages

### Ce qu’il faut
- Un dépôt GitHub (public, compte gratuit : GitHub Pages est offert) et le dossier
  `ordely-corrige` de votre côté. Le dépôt actuel `ordely` convient : copiez les fichiers dedans.
- Un téléphone avec **Chrome (Android)** ou **Safari (iPhone)**. Évitez les navigateurs intégrés
  aux applications (Instagram, Facebook, Gmail…) : ils bloquent souvent le micro.

### A1. Envoyer la version corrigée sur GitHub
Trois méthodes, au choix. Un guide détaillé existe : `docs/METTRE-A-JOUR-GITHUB.md`.

**Méthode 0 — dépôt prêt à pousser (une commande, mise à jour complète)**
1. Téléchargez `ordely-pret-a-pousser-git.zip` et décompressez-le.
2. Dans un terminal :
   ```bash
   cd ordely-a-pousser
   bash scripts/pousser-vers-github.sh
   ```
   L’envoi est une **avance rapide** sur l’historique d’origine : rien n’est écrasé.
   GitHub demande un **jeton d’accès personnel** en mot de passe (voir le guide), à révoquer ensuite.
3. Passez à **A2** avec la Source **GitHub Actions**.

**Méthode 1 — l’archive prête à publier (recommandée)**
1. Téléchargez `ordely-pour-github-pages.zip` (fourni avec ce dossier).
2. Décompressez-la **à la racine** de votre dépôt GitHub : vous devez y voir `index.html`,
   `assets/`, `demo-data.json`, `manifest.webmanifest`, `sw.js`, `.nojekyll`.
3. Poussez sur la branche **main** (`git add -A && git commit -m "Ordely V10" && git push`),
   puis passez directement à **Settings → Pages** décrit en A2 (choix « Deploy from a branch »).
   Le fichier `README-HEBERGEMENT.md` présent dans l’archive rappelle ces étapes.

**Méthode 2 — le dossier complet + le script fourni**
1. Décompressez `ordely-corrige-V10.zip` (projet entier, avec les tests et la documentation).
2. Publiez-le en une commande, sans écraser votre branche `main` :
   ```bash
   bash scripts/publier-sur-github.sh https://github.com/mahdibenayed14-star/ordely.git
   ```
   Le script crée une branche `v10-corrige`, l’envoie, et GitHub vous propose la Pull Request à
   fusionner. Puis passez en A2 avec la Source **GitHub Actions**.
   (Si vous préférez tout faire à la main : copiez le contenu du dossier dans votre dépôt, en
   remplaçant les anciens fichiers — `public/` avec `public/assets/`, `index.html` et
   `.github/workflows/pages.yml` sont indispensables.)

### A2. Activer GitHub Pages
3. Dans le dépôt : **Settings → Pages**.
4. Dans **Source**, choisissez l’une des deux options :
   - **Deploy from a branch** → **Branch : main**, **Dossier : /(root)** — si vous avez utilisé
     l’archive `ordely-pour-github-pages.zip` (méthode 1) ;
   - **GitHub Actions** — si vous avez poussé le projet complet (méthode 2) : le workflow
     « Publier la démo gratuite sur GitHub Pages » publie alors le dossier `public/`.
5. Si vous avez choisi **GitHub Actions** : ouvrez l’onglet **Actions** et attendez le voyant vert
   (1 à 2 minutes). Si le workflow n’apparaît pas : **Actions → Publier la démo gratuite →
   Run workflow**.
6. Sur la page **Settings → Pages**, l’adresse s’affiche ; elle ressemble à :
   `https://mahdibenayed14-star.github.io/ordely/`

> Remarque : GitHub Pages ne sait exécuter qu’une page statique. Le mode gratuit est justement
> prévu pour ça : il n’a pas besoin du serveur Node. Le serveur sert uniquement au mode streaming
> facultatif et à la base partagée.

### A3. Ouvrir sur le téléphone
7. Ouvrez l’adresse `https://…github.io/ordely/` dans **Chrome** (Android) ou **Safari** (iPhone).
8. Vérifiez que la barre d’adresse affiche bien `https://` (le micro l’exige sur téléphone).

### A4. Vérifier le matériel (30 secondes, utile avant la vraie démonstration)
9. Descendez jusqu’à **« Tout est bien branché ? »** et appuyez sur **🎙 Tester le micro**.
10. Parlez pendant les 8 secondes du test : la **barre doit bouger**. Si elle ne bouge pas,
    suivez le message d’erreur affiché (il est précis) ou le tableau de dépannage plus bas.
11. Appuyez sur **♪ Tester le son** : vous devez entendre un bip. Montez le volume des médias,
    désactivez le mode silencieux sur iPhone.

### A5. Faire la conversation
12. Laissez **Mode = Gratuit · voix du navigateur** et **Langue = Derja tunisienne / ar-TN**.
13. Appuyez **une seule fois** sur **▶ Démarrer**. La première fois, le navigateur demande
    l’autorisation du micro : appuyez sur **Autoriser**.
14. Ne touchez plus à rien : Ordely commence la conversation tout seul (« عسلامة … »).
15. Parlez **sans appuyer sur aucun bouton**, naturellement, même pendant qu’Ordely parle.
16. Regardez la conversation : votre phrase apparaît d’abord en provisoire (« Transcription en
    cours… »), puis en texte final ; la réponse d’Ordely s’affiche **immédiatement en texte**, et
    elle est lue à voix haute si l’option est cochée.

### A6. Tester les trois questions importantes
17. **L’interruption** : pendant qu’Ordely parle, dites par exemple
    « La la, estanna, l’adresse تبدّلت » → la voix doit s’arrêter tout de suite, la bulle
    d’Ordely porte la mention « Interrompu », et il vous répond sur la nouvelle demande.
18. **La parole directe** : enchaînez ensuite « 15 rue de la Liberté, Tunis » puis « oui » :
    l’adresse doit changer, et la commande **reste** « À CONFIRMER » jusqu’à un « oui » final.
19. **Le texte en direct** : vérifiez que les deux bulles (la vôtre et celle d’Ordely) sont
    horodatées et lisibles ; le bouton **↓ Texte** télécharge la transcription complète.

### A7. Rejouer la démonstration
20. **■ Arrêter**, puis **Réinitialiser les commandes de démo**, puis **▶ Démarrer** :
    vous repartez sur une démonstration propre, à chaque fois.

---

## B. Essai sur ordinateur, avec le serveur Node.js

1. Installez **Node.js 20 ou plus** (https://nodejs.org).
2. Dans un terminal, ouvrez le dossier du projet puis exécutez :
   ```bash
   npm install
   npm start
   ```
3. Ouvrez `http://localhost:10000` dans **Chrome**. Sur `localhost`, le micro est autorisé sans HTTPS.
4. Cliquez sur **Démarrer** et déroulez les étapes A4 à A7.
5. Adresse de contrôle pour vérifier que le serveur va bien :
   `http://localhost:10000/health` → `{"ok":true,"version":"10.0.0",...}`.

### B2. Héberger le serveur (facultatif) sur Render
- Render peut lire directement le dépôt : **New → Web Service**, *Build command* `npm ci --omit=dev`,
  *Start command* `npm start`, *Health check path* `/health`. `render.yaml` est déjà fourni.
- Après le déploiement, l’URL `https://…onrender.com` fonctionne aussi depuis le téléphone.
- Le mode gratuit y fonctionne **sans aucune clé** ; l’ajout des clés Deepgram/ElevenLabs active
  en plus l’option *Streaming*, hors sujet pour un essai sans frais.

### B3. Vérifier que le déploiement est correct (une commande)
```bash
node scripts/verifier-deploiement.mjs https://VOTRE-SERVICE.onrender.com
```
Attendu : **6/6 contrôles réussis**, dont « Démarrage vocal en français » et « Démarrage vocal en
derja ». Si un contrôle échoue, le script explique la piste à suivre. Détail complet du mode serveur
et du streaming : `docs/DEPLOIEMENT-RENDER.md`.

---

## C. Si quelque chose ne va pas (dépannage)

| Ce que vous voyez | Cause probable | Ce qu’il faut faire |
|---|---|---|
| « Reconnaissance vocale absente » | Mauvaise famille de navigateur, ou page ouverte dans une application | Ouvrir le lien dans Chrome Android ou Safari iPhone |
| « Micro refusé » | Autorisation refusée | Touchez le cadenas/le « A » dans la barre d’adresse → Autorisations → Microphone → Autoriser, puis rechargez |
| « Le micro exige une URL HTTPS » | Page ouverte en `http://` sur une IP locale, ou fichier ouvert directement | Utiliser l’adresse `https://…github.io/…` |
| La barre du test micro ne bouge pas | Micro occupé par un autre appel/application, ou mauvais périphérique | Fermer les autres applications audio, vérifier le périphérique d’entrée du téléphone, réessayer |
| Ordely se coupe tout seul | Le micro capte le haut-parleur (écho) | **Mettre un casque**, ou monter le **Seuil d’interruption** dans les réglages |
| La voix ne se lance pas | Volume trop bas, mode silencieux, ou voix arabe absente du téléphone | **♪ Tester le son**, monter le volume ; au besoin passer **Langue = Français** pour vérifier |
| Le statut affiche « BLOQUÉE » | Le service vocal du navigateur a échoué plusieurs fois (souvent réseau) | Vérifier Internet, puis **Relancer l’écoute**. Le texte reste utilisable entre-temps |
| L’application s’arrête seule | Passage en arrière-plan (arrêt de confidentialité) | Revenir sur la page et appuyer sur **Démarrer** ; sur iPhone, garder l’écran allumé |
| Rien ne s’affiche au chargement | Page ouverte depuis un fichier local, ou GitHub Pages pas encore publié | Servir le dossier `public/` par une URL HTTP(S) (npm start ou GitHub Pages) |

Vous pouvez aussi ouvrir **« Diagnostic et limites du mode gratuit »** en bas de la page : version,
contexte HTTPS, état du micro, reconnaissance, connexion, persistance et journal technique y sont
listés, ce qui permet de comprendre l’état exact pendant la démonstration.

## D. Réponses directes à vos questions

- **Peut-on parler directement sans toucher un bouton « Parler » ?** Oui. Un seul clic sur
  **Démarrer** (nécessaire pour autoriser le micro), ensuite vous parlez quand vous voulez.
- **Peut-on interrompre l’agent, et vous entend-il tout de suite ?** Oui. Dès que votre voix est
  détectée, la lecture s’arrête, l’interruption est affichée, et votre phrase part au moteur de
  commande **dès sa transcription finale** — quelques dixièmes de seconde plus tard. Ordely agit
  vraiment sur la commande (adresse, produit, quantité, prix, rappel, annulation).
- **La transcription est-elle visible en direct ?** Oui : provisoire pendant que vous parlez, puis
  finale. La réponse d’Ordely apparaît en texte dès qu’elle est produite, même avant la fin de la
  lecture vocale.
- **Que se passe-t-il si je ne dis rien pendant qu’il parle ?** Il termine sa phrase et reste à
  l’écoute, sans aucune action de votre part.
