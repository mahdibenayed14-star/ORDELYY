#!/usr/bin/env bash
# Envoie la version corrigée Ordely V10 vers votre dépôt GitHub.
#
#   bash scripts/pousser-vers-github.sh
#   bash scripts/pousser-vers-github.sh https://github.com/mon-compte/ordely.git
#   bash scripts/pousser-vers-github.sh git@github.com:mon-compte/ordely.git ma-branche
#
# Le dépôt fourni contient déjà l'historique d'origine : l'envoi sur « main » est donc une
# AVANCE RAPIDE (aucun écrasement, aucune force). GitHub vous demandera vos identifiants :
# utilisez un jeton d'accès personnel (PAT) en mot de passe, ou GitHub Desktop si vous préférez.
set -euo pipefail
depot="${1:-https://github.com/mahdibenayed14-star/ordely.git}"
branche="${2:-main}"
racine="$(cd "$(dirname "$0")/.." && pwd)"
cd "$racine"

command -v git >/dev/null || { echo "Git n'est pas installé. Installez-le (https://git-scm.com) ou utilisez l'interface web de GitHub." >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Ce dossier n'est pas un dépôt git. Utilisez l'archive ordely-corrige-V10.zip." >&2; exit 1; }

echo "Dernier commit local :"
git --no-pager log --oneline -1
echo
echo "Fichiers qui seront envoyés :"
git --no-pager diff --stat HEAD~1..HEAD | tail -3
echo
if git remote get-url origine >/dev/null 2>&1; then git remote set-url origine "$depot"; else git remote add origine "$depot"; fi
echo "Aucune modification non validée ?"
if [ -n "$(git status --porcelain)" ]; then
  echo "Il reste des modifications : elles sont d'abord validées."
  git add -A
  git -c user.email="ordely@local" -c user.name="Ordely" commit -q -m "Ordely V10 : fichiers complémentaires"
fi
echo
echo "→ Envoi vers $depot (branche $branche)…"
if ! git push origine "HEAD:refs/heads/$branche"; then
  cat >&2 <<'FIN'

L'envoi a été refusé. Causes fréquentes :
  • Mot de passe refusé : GitHub n'accepte plus les mots de passe. Créez un jeton d'accès
    personnel (Settings → Developer settings → Personal access tokens → Fine-grained,
    permission « Contents : Read and write » sur ce dépôt) et utilisez-le en mot de passe.
  • Droits insuffisants : vérifiez que vous êtes bien propriétaire du dépôt.
  • Dépôt distant modifié en parallèle : lancez « git pull --rebase origine main » puis réessayez.
FIN
  exit 1
fi

cat <<FIN

✅ Envoi terminé.

Étapes suivantes :
  1. GitHub → votre dépôt → onglet « Actions » : le workflow « Publier la démo gratuite sur GitHub Pages »
     doit passer au vert (1 à 2 minutes).
  2. GitHub → Settings → Pages → Source : « GitHub Actions ». L'adresse du site s'affiche sur cette page,
     du type https://VOTRE-COMPTE.github.io/ordely/
     (Si vous publiez plutôt l'archive statique : Source « Deploy from a branch », branche « main », dossier « /(root) ».)
  3. Vérifiez le déploiement :  node scripts/verifier-deploiement.mjs https://VOTRE-COMPTE.github.io/ordely/
  4. Ouvrez l'adresse sur votre téléphone (Chrome Android ou Safari iPhone) et faites l'essai :
     Tester le micro → Tester le son → Démarrer.
FIN
