# Contrat d’API (V10)

## HTTP

| Méthode | Chemin | Réponse | Notes |
|---|---|---|---|
| GET | `/` | Interface complète | Servie depuis `public/` |
| GET | `/telephone/` | Interface autonome | Un seul fichier, aucun appel réseau |
| GET | `/health` | `{ok, version, mode}` | Contrôle de déploiement (Render : *health check path*) |
| GET | `/api/config` | `{version, backend, demo, demoReset, modes, streamMaxMinutes}` | Aucune clé n’est exposée |
| GET | `/api/orders` | `[{id, customer, total, status}]` | Commandes de démonstration uniquement |
| GET | `/api/orders/:id` | Commande enrichie (`customer`, `items[].product`, `total`) | `404` si inconnue |
| POST | `/api/demo/reset` | `{ok, orders}` | Origine du site uniquement ; `403` sinon |

## WebSocket `/voice`

Voir le tableau de protocole complet dans `ARCHITECTURE.md`. Règles de conception :

- Le client n’envoie une phrase qu’après `session_ready` ; le serveur répond à chaque message d’erreur
  avec `{type:'error', code, message}` et ne ferme pas la connexion pour un message invalide.
- Une phrase utilisateur est **idempotente** : même `id` = même effet, une seule fois.
- Une interruption (`interrupt`, `SpeechStarted`) annule la production TTS et renvoie
  `{type:'interrupted', id}` pour que le texte de la réponse interrompue reste affiché et signalé.
- La session streaming expire après `STREAM_MAX_MINUTES` (10 par défaut) avec le code de fermeture
  `4003` ; la réinitialisation de démo utilise le code `4008`.

## Contrats prévus pour la suite (téléphonie et back-office)

```
POST /api/order/session   { orderId, customer, product, quantity, size, address, phone }
  → { sessionId, state, allowedActions }
POST /api/order/decision  { sessionId, intent, extractedFields, confirmationGate }
  → { state, decision, auditId }
POST /api/order/callback  { sessionId, requestedAt }
  → { state, callbackId }
POST /api/order/handoff   { sessionId, reason, summary }
  → { state, handoffId }
```

Rappel : le navigateur ne contient **jamais** de clé de fournisseur (LLM, STT, TTS, téléphonie) ;
ces identifiants restent côté serveur, en variables d’environnement.
