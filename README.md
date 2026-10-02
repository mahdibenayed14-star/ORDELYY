# Ordely — démo vocale de confirmation de commandes (Tunisie)

Version corrigée **V10** du dossier `ordely`. Objectif : lancer une conversation vocale en derja
tunisienne qui **démarre toute seule**, **écoute sans bouton** et **affiche la transcription en
direct**, avec possibilité d’**interrompre l’agent**.

## Lancer la démo maintenant

1. **Lien immédiat** : ouvrez le panneau **Live Preview** de cette conversation
   (« Ordely — démo vocale gratuite »). Le micro est bloqué dans le cadre d’aperçu : cliquez sur le
   bandeau **« Ouvrir l’application ↗ »** pour basculer dans un onglet normal, puis **🎙 Tester le
   micro** et **▶ Démarrer**. Ce lien vit tant que l’espace de travail est ouvert.
2. **Lien permanent sur votre compte** (recommandé pour la démonstration au jury) : publiez le
   dossier sur GitHub Pages — voir **[ETAPES-ESSAI.md](ETAPES-ESSAI.md)**, partie A (5 minutes,
   gratuit, aucune clé).

## Archives à télécharger

| Fichier | Contenu | Usage |
|---|---|---|
| `ordely-pour-github-pages.zip` | la page publiée + `assets/` + la notice d’hébergement | à décompresser **à la racine** du dépôt GitHub (Add file → Upload files), puis Pages → *Deploy from a branch* |
| `ordely-pret-a-pousser-git.zip` | dépôt git **prêt à pousser**, avec l’historique d’origine conservé | `bash scripts/pousser-vers-github.sh` → mise à jour complète en une commande, sans risque d’écrasement |
| `ordely-corrige-V10.zip` | le projet complet (code, tests, docs, serveur) | essai local avec `npm start`, hébergement Node/Render, publication via `.github/workflows/pages.yml` |

Mise à jour du dépôt GitHub : **[docs/METTRE-A-JOUR-GITHUB.md](docs/METTRE-A-JOUR-GITHUB.md)**
(chemin sans Git en 5 minutes, ou chemin Git en une commande avec jeton d’accès personnel).

Le dossier contient deux façons d’utiliser la même application :

| | Mode gratuit (recommandé pour le téléphone) | Mode serveur Node.js |
|---|---|---|
| Fichier à publier | `public/` sur GitHub Pages, ou un seul fichier `index.html` | tout le dépôt, avec `npm start` |
| Reconnaissance | API vocale du navigateur | API vocale du navigateur (gratuit) ou Deepgram (facultatif) |
| Voix de l’agent | Voix système du navigateur | Voix système, ou ElevenLabs en streaming (facultatif) |
| Commandes de démo | Enregistrées **sur votre téléphone** | Enregistrées sur le serveur, en JSON |
| Clés API | Aucune | Aucune pour le gratuit ; options payantes inactives par défaut |

Le moteur de commande n’appelle **aucun modèle de langage** : chaque opération est validée par
règles, donc la démo ne peut pas inventer une modification. Seules la reconnaissance vocale et la
voix dépendent du fournisseur du navigateur (Google pour Chrome/Android, Apple pour Safari/iOS).

## Démarrer en 1 commande (ordinateur)

```bash
npm install
npm start
```
Puis ouvrez `http://localhost:10000`. Laissez **Mode = Gratuit** et cliquez sur **Démarrer**.

## Démarrage sur téléphone (gratuit, HTTPS)

Voir le pas à pas détaillé : **[ETAPES-ESSAI.md](ETAPES-ESSAI.md)**.
Résumé : publiez le dossier `public/` sur GitHub Pages (ou copiez `index.html` sur n’importe quel
hébergement HTTPS), ouvrez le lien dans **Chrome Android** ou **Safari iPhone**, autorisez le micro,
puis cliquez une seule fois sur **Démarrer**.

## Ce qui a été corrigé

Détail cause → correction → test : **[docs/CORRECTIONS-V10.md](docs/CORRECTIONS-V10.md)**.
Les cinq points signalés :

1. **La conversation ne démarrait pas** — l’ancienne page écoutait un serveur absent (ou qui ne
   répondait pas) ; il fallait en plus envoyer `select` puis `start`. Désormais le démarrage est
   **écouté par accusé de réception** (`session_ready`), et sans backend l’application fonctionne
   en autonome : le premier message de l’agent arrive automatiquement.
2. **Le micro ne marchait pas** — conditions HTTPS/permission réelles, messages de diagnostic
   précis, test micro séparé, et repli automatique si un téléphone refuse la capture.
3. **Faut-il toucher un bouton « Parler » ?** — Non : un seul clic sur **Démarrer** suffit, puis
   l’écoute est continue et relancée automatiquement.
4. **Peut-on interrompre l’agent ?** — Oui : dès que votre voix est détectée, la lecture est coupée
   immédiatement, l’interruption est affichée, et **la reconnaissance n’est plus arrêtée** comme
   avant. La phrase interrompue continue d’être comprise et reçoit une réponse.
5. **Transcription en direct absente** — les résultats provisoires du moteur vocal s’affichent
   dans la conversation avec la mention « Transcription en cours… », puis le texte final remplace le
   provisoire, sans doublon.

## Limites honnêtes du mode gratuit

- La reconnaissance et la voix **appartiennent au navigateur** : la qualité en derja tunisienne
  dépend de l’appareil. Aucune voix « ar-TN » garantie.
- Sur certains téléphones **sans casque**, le micro entend le haut-parleur : le niveau RMS/VAD est
  alors désactivé automatiquement pour laisser le service natif gérer le micro, et l’interruption
  passe par la détection de parole du service vocal.
- L’application s’arrête volontairement quand elle passe en arrière-plan (confidentialité) : sur
  iPhone, gardez l’écran allumé. Un bouton **Relancer l’écoute** est disponible.
- **Aucun enregistrement audio n’est conservé** par Ordely. En mode GitHub Pages, les commandes de
  démo restent dans le navigateur. La transcription peut être téléchargée en `.txt`.
- Pas d’appel téléphonique réel : la demande de rappel est enregistrée, jamais planifiée.

## Structure du dossier

```
ordely-corrige/
├── index.html               # page téléphone autonome (tout inclus, à copier seul si besoin)
├── public/                  # application complète (source + version GitHub Pages)
│   ├── index.html           # interface
│   ├── sw.js                # cache hors ligne (interface uniquement)
│   ├── demo-data.json       # base de démonstration
│   └── assets/              # app.js, voice.js, order-engine.js, audio-utils.js, mic-worklet.js, transport.js, styles.css
├── server.js                # serveur Express + WebSocket
├── src/server.js            # endpoints, sessions, orchestration
├── src/providers.js         # Deepgram STT + ElevenLabs TTS (mode streaming facultatif)
├── tests/                   # 66 tests unitaires (moteur, audio, fournisseurs, serveur, worklet)
├── e2e/                     # 51 tests navigateur (Chromium téléphone/ordinateur, WebKit iPhone)
├── scripts/build-phone.mjs  # génère index.html et telephone/index.html
├── scripts/verifier-deploiement.mjs  # contrôle un déploiement en 6 points
├── scripts/publier-sur-github.sh     # publie sur GitHub sans écraser main
├── scripts/creer-dossier-zip.sh
├── SUIVI-TRAVAIL.md         # état d’avancement et preuves
├── ETAPES-ESSAI.md          # pas à pas d’essai
├── JURY_DEMO.md             # scénario de démonstration de 3 minutes
├── CHECKLIST.md             # liste à cocher avant la démonstration
├── .env.example             # variables, aucune clé obligatoire
├── render.yaml / .github/workflows/pages.yml
└── docs/                    # architecture, corrections, API
```

## Commandes utiles

```bash
npm start            # serveur local + interface
npm test             # 67 tests unitaires
npm run test:e2e     # 54 tests navigateur (nécessite `npx playwright install chromium webkit`)
npm run phone        # reconstruit index.html et telephone/index.html
npm run dev          # serveur avec rechargement automatique
node scripts/verifier-deploiement.mjs <url>   # contrôle un déploiement (local, Render…) : 6 vérifications
```

Suivi du travail et état d’avancement : **[SUIVI-TRAVAIL.md](SUIVI-TRAVAIL.md)**.
Déploiement serveur et streaming facultatif : **[docs/DEPLOIEMENT-RENDER.md](docs/DEPLOIEMENT-RENDER.md)**.

## Mode streaming facultatif (payant, non requis)

Renseignez `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY` et `ELEVENLABS_VOICE_ID` **côté serveur**
(jamais dans `public/`), redéployez, puis choisissez `Streaming` dans le panneau des réglages.
Le serveur répond par défaut avec `nova-3` en `ar-TN` ; Deepgram a publié le support de l’arabe
tunisien sur Nova-3 en janvier 2026. La session streaming est plafonnée à 10 minutes par défaut
(`STREAM_MAX_MINUTES`). Vérifiez les crédits et les conditions d’utilisation des deux services.
