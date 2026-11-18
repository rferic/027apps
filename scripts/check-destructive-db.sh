#!/usr/bin/env bash
#
# Fails when automation in this repository could reset or push into a remote
# database behind the owner's back.
#
# The Supabase CLI can do it: since 2.x, `supabase db reset --remote[=<ref>]`
# cleans the **linked** project (or the named one) and replays the migrations.
# That is a legitimate disaster-recovery move and a catastrophic accident, so
# it is never something committed automation should run: the only sanctioned
# path to a remote database is the `migrations.yml` job, which is limited to
# `db push --linked` and gated by the `production` environment (required
# reviewer).
#
# Reads the checked-out tree, needs no network and no secrets.

set -euo pipefail

cd "$(dirname "$0")/.."

# Only files that can be executed: workflows, scripts and package manifests.
files=$(
  git ls-files \
    '.github/**/*.yml' '.github/**/*.yaml' \
    'scripts/**' \
    'package.json' '*/*/package.json' 'apps/**/package.json' 'packages/**/package.json' \
    'supabase/**' \
    | grep -v '^scripts/check-destructive-db.sh$' || true
)

hits=""
count=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  count=$((count + 1))
  # --remote / --linked on reset, and a raw --db-url on any command that writes.
  found=$(grep -nE \
    -e 'db[[:space:]]+reset[^#]*--(remote|linked|db-url)' \
    -e 'db[[:space:]]+push[^#]*--db-url' \
    -e 'migration[[:space:]]+up[^#]*--db-url' \
    -e 'db[[:space:]]+pull[^#]*--db-url' \
    "$file" | grep -vE '^[0-9]+:[[:space:]]*#' || true)
  if [ -n "$found" ]; then
    hits="${hits}${file}:${found}"$'\n'
  fi
done <<< "$files"

if [ -n "$hits" ]; then
  echo "::error::Automation that resets or pushes into a remote database:"
  printf '%s' "$hits"
  echo "Remote databases change only through .github/workflows/migrations.yml (db push, production environment)."
  exit 1
fi

echo "ok: no remote reset or raw --db-url in automation (${count} files)"
