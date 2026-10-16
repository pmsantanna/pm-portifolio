#!/usr/bin/env sh
# Copia o noise-core do repositório do Noise para src/vendor/noise-core/.
#
#   scripts/sync-noise-core.sh ../noise
#
# A fonte de verdade é o Noise: nada aqui deve ser editado à mão. Cada
# arquivo .js ganha na primeira linha o commit de onde veio, para saber
# quando a cópia está desatualizada (compare com `git -C ../noise log -1`).
set -eu

SRC="${1:-../noise}"
DEST="$(dirname "$0")/../src/vendor/noise-core"
HASH="$(git -C "$SRC" rev-parse --short HEAD)"

if [ -n "$(git -C "$SRC" status --porcelain -- noise-core)" ]; then
  echo "noise-core tem mudanças não commitadas em $SRC — commit antes de copiar" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp "$SRC"/noise-core/*.js "$SRC"/noise-core/package.json "$DEST"/

for f in "$DEST"/*.js; do
  printf '%s\n' "// noise-core @ $HASH (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh" | cat - "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
done
printf '%s\n' "$HASH" > "$DEST/COMMIT"
echo "noise-core @ $HASH → $DEST"
