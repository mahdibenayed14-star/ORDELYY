# Architecture Ordely V10

## Vue d’ensemble

```
Téléphone / navigateur
  ├─ interface (public/index.html + assets/app.js)
  ├─ VoiceIO (assets/voice.js)
  │    ├─ capture : AudioWorklet → PCM 16 kHz mono (mode streaming uniquement)
  │    ├─ VAD local : RMS + attaque/relâchement (interruption rapide)
  │    ├─ reconnaissance : Web Speech API (mode gratuit) ou Deepgram (streaming)
  │    ├─ lecture : Web Audio (PCM 24 kHz) ou synthèse du navigateur
  │    └─ journal : provisoire / final / interruption / lecture
  ├─ Transport
  │    ├─ LocalTransport : commandes dans le navigateur (GitHub Pages, hors ligne)
  │    └─ SocketTransport : WebSocket /voice vers le serveur Node
  └─ OrderEngine (public/assets/order-engine.js)  ← le même moteur des deux côtés

Serveur Node (server.js, src/server.js)
  ├─ HTTP : /, /telephone/, /health, /api/config, /api/orders[/:id], /api/demo/reset
  ├─ WebSocket /voice : start → session_ready → assistant → user → …
  ├─ Orchestration : moteur métier, persistance JSON atomique, limites et garde-fous
  └─ Fournisseurs (facultatifs) : src/providers.js
       ├─ DeepgramSTT  (nova-3, ar-TN, provisoire, endpointing, UtteranceEnd)
       └─ streamSpeech (ElevenLabs PCM 24 kHz, annulable, débit contrôlé)
```

## Protocole WebSocket

| Sens | Message | Notes |
|---|---|---|
| S→C | `connected` | Envoyé dès l’ouverture, avant tout traitement |
| C→S | `start` | `{orderId, language, mode, voiceEnabled}` |
| S→C | `session_ready` | Accusé de réception avec `{state, order}` : le client démarre ensuite |
| S→C | `assistant` | `{id, text, state, order}` — texte affiché immédiatement |
| C→S | `user` | `{id, text}` — l’`id` déduplique les envois d’une même phrase |
| S→C | `user_final` / `user_interim` | Reconnu / provisoire |
| C→S | `interrupt` | Annule la production TTS en cours |
| S→C | `interrupted`, `audio_begin`, `binary`, `audio_done` | Audio étiqueté par `audioId` (entier 32 bits en tête de trame) |
| S→C | `error` | `{code, message}` : cause explicite, jamais de silence |

## Décisions structurantes

- **Un seul cœur métier** (`order-engine.js`) partagé par le navigateur et Node : le comportement est
  identique en mode GitHub Pages et en mode serveur, et il est testable sans navigateur.
- **Priorité métier** : un tour = une action. L’ordre de résolution est : état d’un champ en cours →
  prix → annulation → rappel → suppression → couleur/size/quantité → confirmation → réponse par
  défaut. Un changement de sujet explicite est détecté et clôt proprement la question en cours.
- **Deux interruptions, jamais de conflit** : le service vocal signale la parole
  (`onspeechstart`, `SpeechStarted`, provisoire) et le VAD local surveille le signal brut. Les deux
  aboutissent à `stopOutput()` + notification serveur ; la reconnaissance est **préservée**.
- **Audio étiqueté** : chaque réponse a un `responseId` et un `audioId` ; à l’interruption, les
  trames en retard sont ignorées, ce qui évite les reprises audio fantômes.
- **Pas de clé côté client** : `public/` ne contient aucune clé ; `src/providers.js` est le seul
  module qui parle aux services payants, et il n’est actif que si les variables existent.
- **Base de démonstration** : `public/demo-data.json` est la graine ; le navigateur garde sa copie
  dans `localStorage`, le serveur dans `data/database.json` (écriture atomique).
- **Hors ligne** : le service worker ne met en cache que l’interface ; les commandes restent
  utilisables sans réseau (persistance locale), et les mises à jour passent par un rechargement
  explicite pour ne jamais resservir une version ancienne.

## Évolutions prévues (hors V10)

- Adaptateur téléphonie PSTN (Twilio / SIP / opérateur tunisien) branché sur la même machine d’état.
- Journal d’audit persistant et tableau de bord des décisions (contrat déjà proposé dans
  `docs/API_CONTRACT.md`).
- Ancrage du LLM sur le catalogue pour un mode génératif, tout en conservant le moteur à règles
  comme garde-fou d’exécution.
