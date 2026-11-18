#!/usr/bin/env bash
#
# Takes a restorable dump of the **local** Supabase database.
#
# The development stack lives in Docker and a `supabase db reset` deletes it
# (accounts, invitations, modules, demo data). This dump is the safety net: it
# runs before a sanctioned reset and can be scheduled, so a wipe costs minutes,
# not the afternoon.
#
# Local only, on purpose: it refuses any project that is not a local container.
# A production dump is a different tool (`scripts/backup/backup.sh`).
#
# Usage: scripts/db-local-backup.sh [--keep N] [--dir PATH]
#   --keep N   keep the newest N dumps (default 20)
#   --dir PATH where to write them (default .local/db-backups, gitignored)

set -euo pipefail

cd "$(dirname "$0")/.."

keep=20
dir=".local/db-backups"

while [ $# -gt 0 ]; do
  case "$1" in
    --keep) keep="${2:-}"; shift 2 ;;
    --dir) dir="${2:-}"; shift 2 ;;
    -h | --help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$keep" in
  ''|*[!0-9]*) echo "--keep needs a number" >&2; exit 2 ;;
esac

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 2; }

container="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
if [ -z "$container" ]; then
  echo "No supabase_db_* container running: the local stack is down, there is nothing to dump." >&2
  exit 2
fi

mkdir -p "$dir"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$dir/local-$stamp.dump"

# -Fc: compressed custom format, restorable with pg_restore into the same stack.
docker exec "$container" pg_dump -U postgres -d postgres --format=custom --no-owner \
  > "$file"
size="$(du -h "$file" | cut -f1)"
echo "backup: $file ($size)"

# Retention: only the newest $keep dumps stay.
ls -1t "$dir"/local-*.dump 2>/dev/null | tail -n +$((keep + 1)) | while IFS= read -r old; do
  rm -f "$old"
done

echo "restore with: scripts/db-local-restore.sh $file"
