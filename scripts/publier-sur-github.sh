#!/usr/bin/env bash
# Publie la version corrigée dans un dépôt GitHub, sur une branche dédiée (aucun écrasement de main).
#
#   bash scripts/publier-sur-github.sh https://github.com/mon-compte/ordely.git
#   bash scripts/publier-sur-github.sh git@github.com:mon-compte/ordely.git v10-corrige
#
# Ensuite : ouvrez la Pull Request proposée par GitHub, fusionnez dans main, puis
# Settings → Pages → Source = GitHub Actions (le workflow publie déjà public/).
set -euo pipefail
depot="${1:-}"
branche="${2:-v10-corrige}"
if [ -z "$depot" ]; then
  echo "Usage : bash scripts/publier-sur-github.sh <url-du-depot-git> [branche]" >&2
  echo "Exemple : bash scripts/publier-sur-github.sh https://github.com/mahdibenayed14-star/ordely.git" >&2
  exit 1
fi
racine="$(cd "$(dirname "$0")/.." && pwd)"
cd "$racine"
command -v git >/dev/null || { echo "git est introuvable. Installez Git puis réessayez." >&2; exit 1; }
if [ ! -d .git ]; then git init -q && git branch -M main; fi
git add -A
git -c user.email="ordely@local" -c user.name="Ordely" commit -q -m "Ordely V10 : démarrage fiabilisé, écoute continue sans bouton, interruption, transcription en direct" || echo "Aucun nouveau changement à committer."
git remote remove origine >/dev/null 2>&1 || true
git remote add origine "$depot"
echo "Envoi de la branche $branche vers $depot …"
git push -u origine "HEAD:refs/heads/$branche"
cat <<FIN

Branche $branche envoyée.
1) Sur GitHub, ouvrez la Pull Request proposée et fusionnez-la dans main (ou poussez directement sur main
   si vous préférez : git push origine HEAD:main).
2) Settings → Pages → Source = GitHub Actions.
3) Actions → « Publier la démo gratuite sur GitHub Pages » doit être vert : l'URL s'affiche dans Settings → Pages.
FIN
