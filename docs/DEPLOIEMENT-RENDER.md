# Déployer Ordely sur Render (mode serveur, streaming facultatif)

Objectif : obtenir une URL HTTPS **permanente** qui exécute `server.js`, afin d’utiliser soit le mode
gratuit avec base côté serveur, soit le **mode streaming** (Deepgram pour la reconnaissance derja
`ar-TN`, ElevenLabs pour la voix arabe).

> **Rappel important** : le mode gratuit n’a **pas** besoin de Render. Il fonctionne sur GitHub Pages
> sans serveur. Render n’est nécessaire que pour (a) une base de démonstration partagée côté serveur,
> ou (b) le mode streaming. Les clés restent toujours **en variables d’environnement**, jamais dans
> le dépôt ni dans `public/`.

---

## 1. Prérequis

- Un compte Render (plan **Free** suffisant, WebSockets inclus).
- Le dépôt GitHub contenant **le projet complet** (pas seulement la page statique) : `server.js`,
  `src/`, `public/`, `package.json`, `package-lock.json`, `render.yaml`.
- Facultatif (streaming seulement) :
  - une clé **Deepgram** (reconnaissance, `nova-3`, `ar-TN` — le dialecte tunisien est supporté
    depuis janvier 2026) ;
  - une clé **ElevenLabs** et l’identifiant d’une **voix arabe** (`ELEVENLABS_VOICE_ID`).
  - Les deux services proposent des crédits d’essai : surveillez la consommation, un appel vocal
    consomme à la seconde.

---

## 2. Déploiement en 6 étapes

1. Sur Render : **New → Web Service** (ou **New → Blueprint** si vous voulez utiliser le
   `render.yaml` fourni, qui préremplit les réglages ci-dessous).
2. **Connect a repository** : autorisez GitHub si nécessaire, puis choisissez le dépôt Ordely.
3. Réglez la branche (ex. `main`) et les commandes :
   - **Build Command** : `npm ci --omit=dev`
   - **Start Command** : `npm start`
   - **Health Check Path** : `/health`
4. **Instance Type** : `Free`.
5. Onglet **Environment** : ajoutez les variables du tableau §3 (au minimum `NODE_ENV`).
6. **Create Web Service**. Le déploiement prend 1 à 3 minutes ; l’état doit passer au vert, et le
   journal doit afficher `Ordely V10 : http://localhost:…`.

---

## 3. Variables d’environnement

| Nom | Requis | Exemple | Rôle |
|---|---|---|---|
| `NODE_ENV` | recommandé | `production` | Réglages de production |
| `ENABLE_DEMO_RESET` | facultatif | `true` | Autorise le bouton **Réinitialiser les commandes de démo** (limité à l’origine du site) |
| `DATA_FILE` | facultatif | `./data/database.json` | Chemin de la base JSON de démonstration |
| `DEEPGRAM_API_KEY` | streaming | `dk_…` | Active la reconnaissance serveur |
| `DEEPGRAM_MODEL` | streaming | `nova-3` | Modèle de reconnaissance |
| `DEEPGRAM_LANGUAGE` | streaming | `ar-TN` | Dialecte tunisien (`fr` pour un essai en français) |
| `ELEVENLABS_API_KEY` | streaming | `sk_…` | Active la voix serveur |
| `ELEVENLABS_VOICE_ID` | streaming | `21m00Tcm4TlvDq8ikWAM` | Identifiant d’une voix arabe adaptée ; vérifiez sa licence |
| `ELEVENLABS_MODEL` | facultatif | `eleven_turbo_v2_5` | Modèle de synthèse (latence de streaming) |
| `STREAM_MAX_MINUTES` | facultatif | `10` | Plafond de durée d’une session streaming (1 à 30) |

Le mode streaming ne s’active que si **les trois variables obligatoires** (Deepgram, ElevenLabs,
voix) sont présentes : sans elles, l’option reste grisée côté interface et le serveur répond
proprement `Streaming non configuré`.

---

## 4. Vérifier le déploiement

1. **Contrôle automatique** (depuis votre machine, dans le dossier du projet) :
   ```bash
   node scripts/verifier-deploiement.mjs https://VOTRE-SERVICE.onrender.com
   ```
   Attendu : `6/6 contrôles réussis`, avec `Démarrage vocal en français` et `Démarrage vocal en derja`
   confirmant la chaîne complète. En mode streaming, la ligne « API de configuration » indique
   « mode streaming configuré ».
2. **Navigateur** : ouvrez l’URL, **🎙 Tester le micro**, **♪ Tester le son**, puis **▶ Démarrer**
   avec `Mode = Streaming`.
3. **Téléphone** : ouvrez la même URL HTTPS dans Chrome/Safari, comme décrit dans `ETAPES-ESSAI.md`.

---

## 5. Comportements à connaître

- **Mise en veille du plan gratuit** : le service s’endort après une période d’inactivité ; le
  premier appel peut prendre jusqu’à une minute. La page Ordely le gère : si le serveur vocal ne
  répond pas, elle **bascule automatiquement** en mode gratuit avec un message explicite, et vous
  pouvez simplement réessayer ensuite. Le script de vérification refait trois tentatives espacées.
- **Disque éphémère** : la base JSON (`data/database.json`) est réinitialisée à chaque redéploiement
  ou redémarrage du service. C’est volontaire pour une démonstration ; pour un usage réel, remplacez
  la persistance par un service de base de données.
- **Coûts** : Render Free est gratuit ; Deepgram et ElevenLabs sont facturés à l’usage (crédits
  d’essai au départ). Le serveur annule la synthèse dès une interruption, ce qui évite de payer
  l’audio non écouté, et plafonne chaque session (`STREAM_MAX_MINUTES`).
- **Sécurité** : ne mettez jamais ces clés dans le dépôt, ni dans `public/`. Les origines WebSocket
  sont contrôlées ; l’API n’expose que des commandes de démonstration.

---

## 6. Revenir en arrière

- **Désactiver le streaming** : supprimez `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY` et
  `ELEVENLABS_VOICE_ID`, puis redéployez. L’application repasse en mode gratuit, sans autre
  changement.
- **Supprimer le service** : Render → **Settings → Delete Web Service**. La page GitHub Pages
  continue de fonctionner indépendamment.

---

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le déploiement échoue au build | `package-lock.json` absent (nécessaire à `npm ci`) | Poussez le fichier, ou remplacez la commande par `npm install` |
| `/health` ne répond pas tout de suite | Service en veille (plan gratuit) | Attendez ~1 min, puis relancez le contrôle |
| « Streaming non configuré » | Une des trois variables manque | Ajoutez les trois, redéployez |
| « ElevenLabs a refusé la voix (401/403) » | Clé invalide, crédits épuisés, ou accès PCM 24 kHz non autorisé par le plan | Vérifiez la clé et les crédits ; consultez la réponse indiquée dans le message |
| « Deepgram a refusé la connexion (401/402) » | Clé invalide ou crédits épuisés | Vérifiez la clé ; `ar-TN` exige `nova-3` |
| La session se ferme avec « Limite de durée atteinte » | Plafond `STREAM_MAX_MINUTES` atteint | Redémarrez la session, ou augmentez la valeur (max 30) |
| La page affiche « Serveur vocal injoignable : bascule autonome » | Le navigateur n’a pas pu ouvrir le WebSocket (réseau, veille, proxy) | Réessayez après ~1 min ; le mode gratuit a pris le relais entre-temps |
