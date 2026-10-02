#!/usr/bin/env bash
# Crée l'archive ordely-corrige-v10.zip en excluant les dépendances et les rapports de test.
set -euo pipefail
racine="$(cd "$(dirname "$0")/.." && pwd)"
parent="$(dirname "$racine")"
archive="$parent/ordely-corrige-V10.zip"
rm -f "$archive"
cd "$parent"
zip -r -q "$archive" "$(basename "$racine")" \
  -x '*/node_modules/*' -x '*/test-results/*' -x '*/playwright-report/*' \
  -x '*/.git/*' -x '*/.env' -x '*/data/database.json' -x '*/*.log'
echo "Archive créée : $archive"
unzip -l "$archive" | tail -3
