# Ordely V10 — ce qui a été corrigé, et pourquoi

Chaque remarque de la démonstration est traitée avec sa cause exacte dans le code, sa correction,
et le test automatisé qui l’empêche de revenir.

---

## 1. « La conversation ne commence pas »

**Causes trouvées dans la V9/V6.1**

- `public/index.html` (V6.1, la page réellement servie par `server.js`) ouvrait le WebSocket
  `wss://…/voice` vers un backend **Deepgram Voice Agent qui n’existe plus** dans `server.js` :
  aucun `ready`, aucun salut, et les erreurs passaient par un simple `onerror`.
- La page V9 (`index.html` à la racine) envoyait `{type:'select'}` puis `{type:'start'}`
  **après 100 ms de délai arbitraire**, sans attendre `ws.onopen` ni un accusé de réception.
- Le micro était démarré **avant** la connexion, et une erreur de micro empêchait tout démarrage.
- Le service worker pouvait resservir une ancienne page sans mise à jour explicite.

**Correction**

- Un seul protocole WebSocket, chiffré et documenté : `connected` → `start` → **`session_ready`**
  → `assistant`. Le client n’agit qu’après l’accusé de réception du serveur.
- Sans backend (GitHub Pages), `LocalTransport` démarre la session **immédiatement** et produit le
  premier message de l’agent : la conversation commence dans tous les cas.
- Un échec de micro **ne bloque plus** le mode gratuit : la conversation continue en texte, avec un
  message explicite (le blocage reste strict en mode streaming, qui a besoin du micro).
- Le cache hors ligne est versionné, limité aux fichiers de l’interface, et un bouton
  **Recharger la dernière version** le vide si besoin.

**Tests** : `e2e/app.spec.js` (« démarrage auto du salut », « permission refusée : conversation texte
maintenue »), `tests/server.test.js` (« attendre ready puis salut », « commande inconnue refusée,
puis nouvelle tentative autorisée »).

---

## 2. « Le micro ne marche pas »

**Causes**

- Aucun diagnostic : `getUserMedia` échouait silencieusement (permission, HTTPS, périphérique
  occupé, fetch de la page en `file://`).
- La V9 appelait `stop()` au début de `listen()` et `speak()`, ce qui **annulait la reconnaissance**.
- Le micro était renvoyé dans `ctx.destination` via `createScriptProcessor`, produisant un
  larsen/sidétone.

**Correction**

- Vérifications **avant** l’ouverture : contexte sécurisé (HTTPS) et présence de
  `navigator.mediaDevices`, avec messages dédiés pour chaque cas d’erreur standard
  (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `AbortError`).
- Capture par **AudioWorklet** (`public/assets/mic-worklet.js`) avec repli `ScriptProcessor` pour
  les anciens navigateurs ; **la sortie est toujours mise à zéro**, donc aucun retour dans le
  haut-parleur (pas de sidétone).
- Bouton **Tester le micro** isolé (8 secondes, mesure seule, ni envoi ni enregistrement) et bouton
  **Tester le son** pour valider la sortie audio avant l’essai.
- Code d’annulation (`captureEpoch`) : si l’utilisateur appuie sur **Arrêter** pendant que le
  navigateur affiche encore la demande d’autorisation, la piste est bien libérée à l’arrivée.
- Repli automatique : si un téléphone refuse `getUserMedia` + `SpeechRecognition` en même temps
  (erreur `audio-capture`), Ordely désactive sa mesure RMS/VAD et **rend le micro au service natif**
  (statut « Micro natif »), au lieu d’échouer.

**Tests** : `e2e/pipeline.spec.js` (« AudioWorklet réel : niveau mesuré, aucun sidétone, micro
libéré », « worklet intégré en Blob réellement exécutable »), `e2e/app.spec.js` (« permission
refusée », « arrêter pendant la permission tardive libère aussi le micro »),
`tests/worklet.test.js` (sortie nulle, blocs PCM, silence quand micro coupé).

---

## 3. « Je ne sais pas si je peux parler sans toucher le bouton Parler »

**Cause** : la V9 exigeait un clic sur **🎙 Parler** pour **une seule phrase**
(`continuous=false`, `interimResults=false`, arrêt après chaque résultat).

**Correction** : un seul clic sur **Démarrer** ouvre le micro ; ensuite l’écoute est `continuous`,
relancée automatiquement après chaque `onend`, et le bouton « Parler » a disparu. Le statut
**« À vous — Ordely écoute »** et le compteur **Reconnaissance : ÉCOUTE** rendent l’état lisible.
Un bouton **Couper/Activer** le micro et un bouton **Relancer l’écoute** restent disponibles.

**Tests** : `e2e/app.spec.js` (« le micro n’est pas ouvert au chargement », « la reconnaissance se
relance après onend »).

---

## 4. « Je ne sais pas si je peux interrompre l’agent »

**Causes** : `stop()` appelé par `send()` et `speak()` arrêtait la reconnaissance ; `clearAudio()`
vidait la file sans prévenir le serveur ; le moteur V9 continuait d’exécuter l’action interrompue.

**Correction**

- **Deux mécanismes d’interruption** : la détection de parole du moteur vocal (provisoire, la plus
  rapide) et un VAD local (RMS, attaque 120 ms / relâchement 400 ms) qui fonctionne même quand le
  navigateur ne signale pas la parole.
- **La reconnaissance n’est plus jamais arrêtée** lors d’une interruption : le défaut exact est
  verrouillé par un test dédié.
- Le client prévient le serveur (`interrupt`) : la production TTS est annulée via `AbortSignal`,
  ce qui **stoppe la facturation** en mode streaming.
- La bulle interrompue porte la mention **« Interrompu · texte de la réponse prévue »** : les deux
  transcriptions restent lisibles et le contexte de la commande est conservé.
- L’audio déjà reçu est étiqueté par identifiant : après une interruption, les morceaux en retard
  sont ignorés et ne peuvent pas « ressusciter ».
- Seuil d’interruption réglable, et seuil automatiquement relevé pendant la lecture pour limiter
  l’écho du haut-parleur.

**Tests** : `e2e/app.spec.js` (« interrompre coupe le TTS mais pas la reconnaissance »),
`e2e/pipeline.spec.js` (« interruption purge toutes les sources »),
`tests/server.test.js` (« interruption streaming annule la production et conserve le contexte »),
`tests/audio.test.js` (VAD).

---

## 5. « Je ne vois pas la transcription en direct »

**Cause** : `interimResults=false` (aucun texte provisoire) et l’affichage n’était mis à jour
qu’au résultat final ; la réponse de l’agent n’était affichée qu’au début de la lecture audio.

**Correction** : `interimResults=true` et `continuous=true` ; la conversation affiche
**provisoire → final sans doublon** (les segments finaux sont suivis par un identifiant), et la
réponse de l’agent est écrite **dès sa production**, avant même que la voix commence.
Bouton **↓ Texte** pour exporter la transcription horodatée.

**Tests** : `e2e/app.spec.js` (« provisoire puis final, sans doublon »),
`tests/providers.test.js` (segments finaux assemblés une seule fois).

---

## 6. Bugs métier découverts pendant l’analyse (et corrigés)

| Bug V9 | Effet | Correction |
|---|---|---|
| `/non\|no\|لا\|موش/` sans limite de mot | « **no**ir », « tech**no**logie », « **n**umér**o** » déclenchaient un « non » | Détection par mot complet, avec variantes tunisiennes (`لا`, `موش`, `مش`) |
| `text.length > 10` sur le sujet `address` | N’importe quelle phrase longue devenait une nouvelle adresse | Sujet dédié `address_new` : il faut une vraie adresse, puis une confirmation explicite |
| `i.includes('yes')` en repli | « oui » à une question de champ **confirmait tout l’ordre** | Chaque question de champ a son propre état ; la confirmation exige le sujet `confirm` |
| `topic==='size'` jamais défini | La question de taille ne se clôturait jamais | États `item_target` / `item_value` avec retour à `confirm` |
| `qty()` prenait le premier chiffre du texte | « Oppo **Reno 5** » → quantité 5 | Le nom du produit est retiré avant d’extraire la quantité ; bornes 1–20 |
| `remove` sur `o.items[0]` | « enlève le casque » supprimait le premier article | Sélection par nom (avec alias arabes `هواوي`, `اوبو`, `كاسك`) ou demande de précision |
| `intents()` cumulatifs | « je confirme, mais enlève Oppo » faisait les deux à la fois | Une seule intention prioritaire par tour, la plus précise d’abord |
| Pas de garde `date` | « quantité 25-30 » interprété comme 2 | Toute plage ou décimale est refusée et une précision est demandée |
| Contradiction « ne pas annuler » | `no()` renvoyait « non », puis la confirmation suivante était ignorée | Négation détectée avant les intentions de mutation |
| Rappel « rappelle-moi mon adresse » | Déclenchait une demande de rappel téléphonique | Le mot « rappel » ne suffit plus : il faut une intention de rappel, sinon c’est une lecture |
| Commandes `CONFIRMED`/`CANCELLED` encore modifiables | La démo acceptait de modifier une commande traitée | Verrouillage avec message de réinitialisation |

**Tests** : `tests/engine.test.js` — 36 cas couvrant ces points et le parcours complet en français
et en derja (adresse, suppression multi-produits, quantité ciblée, tailles, téléphone, rappel,
annulation, refus, négations, entrées invalides).

---

## 7. Sécurité et robustesse ajoutées

- Le WebSocket refuse les **origines croisées** ; la réinitialisation de la démo est limitée à
  l’**origine du site** et bornée en fréquence. Le rate limiting est explicitement documenté comme
  un garde-fou anti-boucle, **pas** comme une authentification.
- `.env` et `data/database.json` ne sont plus servis ni versionnés (l’Express `static` refuse les
  fichiers cachés et l’API n’expose que des commandes fictives).
- Limite de 4 ko par message HTTP, 64 ko par message WebSocket, 2 000 caractères par phrase,
  écriture atomique (`tmp` + `rename`) de la base JSON.
- Expiration de session : 10 minutes par défaut en streaming (`STREAM_MAX_MINUTES`), heartbeat
  ping/pong de 20 s, plafond de connexions par IP.
- Le mode streaming est **inactif sans clés** et échoue avec un message clair au lieu d’un silence.
- Le service worker ne met en cache **que** l’interface : jamais `/api/`, jamais `/voice`.
