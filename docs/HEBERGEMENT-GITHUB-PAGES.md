# Publier cette page sur GitHub Pages (5 minutes, gratuit)

Ce dossier est la **version prête à publier** de la démo Ordely. Aucun serveur, aucune clé, aucune
installation : GitHub héberge les fichiers, votre téléphone exécute la conversation.

## Étapes

1. Décompressez cette archive **à la racine** de votre dépôt GitHub (celui de `ordely`).
   Vous devez voir à la racine : `index.html`, `assets/`, `demo-data.json`, `manifest.webmanifest`,
   `sw.js`, `.nojekyll`.
2. Poussez sur la branche `main` :
   ```bash
   git add -A
   git commit -m "Ordely V10 : démo vocale corrigée"
   git push
   ```
3. Sur GitHub : **Settings → Pages**.
4. Dans **Source**, choisissez **Deploy from a branch**, puis **Branch : main** et **/(root)**.
   *(Si vous préférez notre workflow `.github/workflows/pages.yml`, laissez la Source sur
   « GitHub Actions » : il publie le dossier `public/` du projet complet, ce qui donne le même
   résultat.)*
5. Attendez 1 à 2 minutes, rechargez la page **Settings → Pages** : l’adresse s’affiche, du type
   `https://VOTRE-COMPTE.github.io/ordely/`.

## Essai sur téléphone

1. Ouvrez cette adresse **https** dans **Chrome (Android)** ou **Safari (iPhone)**.
   Évitez les navigateurs intégrés à une application (Instagram, Facebook, Gmail) : ils bloquent le micro.
2. Descendez à **« Tout est bien branché ? »** → **🎙 Tester le micro** (la barre doit bouger),
   puis **♪ Tester le son** (vous devez entendre un bip).
3. Appuyez **une seule fois** sur **▶ Démarrer**, autorisez le micro, et laissez Ordely commencer.
4. Parlez **sans aucun bouton**, même pendant qu’Ordely parle : la voix s’arrête, votre phrase est
   transcrite en direct, et il répond en conséquence.

Détail complet, dépannage et scénario de démonstration : voir `ETAPES-ESSAI.md`, `CHECKLIST.md` et
`JURY_DEMO.md` dans le projet complet.

## Bon à savoir

- Le dossier `assets/` et `demo-data.json` doivent être publiés en même temps que `index.html` :
  la page ne fonctionne pas seule si on n’envoie qu’un fichier.
  (Si vous voulez un **fichier unique**, utilisez `index.html` du projet complet : c’est la version
  autonome, tout inclus.)
- Les commandes de démonstration sont enregistrées **dans le navigateur** du téléphone. Le bouton
  **Réinitialiser les commandes de démo** remet le scénario à zéro.
- Aucun enregistrement audio n’est conservé ; la transcription peut être téléchargée en `.txt`.
