# Démonstration devant le jury (3 minutes)

## Préparation (à faire 10 minutes avant)

1. Ouvrir l’URL HTTPS sur le téléphone utilisé pour la démonstration (Chrome/Safari).
2. Vérifier que **🎙 Tester le micro** fait bouger la barre et que **♪ Tester le son** se fait
   entendre. Monter le volume des médias.
3. Appuyer sur **Réinitialiser les commandes de démo**, puis recharger la page.
4. Avoir **un casque** prêt (micro-casque conseillé : il supprime l’écho du haut-parleur).
5. Éteindre les notifications, désactiver le mode silencieux, brancher le téléphone au secteur.

## Déroulé

| Temps | Ce que vous dites / faites | Ce que le jury voit |
|---|---|---|
| 0:00 | « Ordely confirme les commandes par la voix, en derja tunisienne. » | La page avec la commande fictive |
| 0:10 | **▶ Démarrer**, autoriser le micro | Ordely parle en premier, la bulle texte apparaît, statut « Ordely vous répond » |
| 0:25 | Laisser Ordely finir | Statut « À vous — Ordely écoute », le micro est ouvert sans bouton |
| 0:35 | « خليلي Huawei ونحي Oppo » | Transcription provisoire puis finale côté client ; les articles et le total changent à l’écran |
| 1:00 | Pendant qu’Ordely parle, couper : « La la, estanna, l’adresse تبدّلت » | **La voix s’arrête immédiatement**, la bulle porte « Interrompu », Ordely répond à la nouvelle demande |
| 1:25 | « 15 rue de la Liberté, Tunis » puis « oui » | L’adresse change, la commande reste « À CONFIRMER » |
| 1:50 | « قداش المجموع؟ » | Réponse avec le total à jour, en texte et en voix |
| 2:05 | « نعاودو نتصلو بيا بعد ساعة » puis « oui » | État « RAPPEL DEMANDÉ », avec la mention qu’aucun appel réel n’est planifié |
| 2:20 | « نحب نلغي الطلبية » puis « non » | La démo refuse d’annuler sans « oui » : garde-fou explicite |
| 2:35 | « ♪ Tester le son » → **Diagnostic** → montrer les lignes **Reconnaissance / Capture / Persistance** | Preuve du matériel et des limites annoncées honnêtement |
| 2:50 | **↓ Texte** et **Réinitialiser les commandes de démo** | La transcription complète est téléchargeable ; le scénario peut être rejoué à l’identique |

## Ce qu’il faut dire si on vous pose ces questions

- **« C’est un vrai LLM qui décide ? »** Non, et c’est volontaire : les actions sur la commande
  sont validées par un moteur à règles côté serveur (ou côté téléphone en mode GitHub Pages), donc
  aucune modification inventée n’est possible. Le mode streaming facultatif ajoute Deepgram
  (reconnaissance ar-TN) et ElevenLabs (voix arabe), sans changer ce moteur.
- **« Et le téléphone ? »** Le mode gratuit utilise la reconnaissance et la voix du navigateur ; le
  mode streaming côté serveur permet de gagner en qualité en production. L’adaptateur PSTN
  (Twilio/SIP/opérateur tunisien) se branche sur la même machine d’état.
- **« Quelles limites assumez-vous ? »** Dépendance au service vocal du navigateur en mode gratuit,
  écho possible sans casque (mesure RMS/VAD alors désactivée automatiquement), arrêt volontaire en
  arrière-plan pour la confidentialité, et aucun appel téléphonique réel dans cette version.
- **« Et la vie privée ? »** Ordely ne conserve aucun enregistrement audio ; les commandes de démo
  restent dans le navigateur, ou dans un fichier JSON du serveur. Aucune clé n’est côté client.

## Repli si le matériel du lieu refuse le micro

1. Rester calme : appuyer sur **Relancer l’écoute**, ou recharger la page et réactiver le micro.
2. Si le micro reste indisponible : **Essayer en texte** permet de dérouler le même scénario en
   tapant les phrases (le jury voit la même logique, la même traçabilité, le même journal).
3. Expliquer la cause affichée par le diagnostic : le dépannage est explicite, ce qui reste une
   preuve de qualité et non un aveu d’échec.
