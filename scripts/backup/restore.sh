#!/usr/bin/env bash
#
# Restores a snapshot produced by backup.sh into an existing Postgres/Supabase
# database. Used for real recoveries and for the restore drill described in
# docs/infrastructure.md.
#
# Required environment:
#   RESTIC_REPOSITORY, RESTIC_PASSWORD, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
#
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: restore.sh --target <postgres-url> [--snapshot <id|latest>] [--schema <name|all>]

  --target    connection string of the database to restore into (it must exist)
  --snapshot  restic snapshot ID (default: latest)
  --schema    schema to restore (default: public); `all` restores the whole dump

`public` is the normal recovery path for a fresh Supabase project: it is cleaned
and recreated in the target database. `all` is the disaster dump (includes
auth/storage metadata) and is restored without --clean, so it is meant for an
empty database, not for a live Supabase project.
EOF
}

target=""
snapshot="latest"
schema="public"

while [ $# -gt 0 ]; do
  case "$1" in
    --target) target="${2:-}"; shift 2 ;;
    --snapshot) snapshot="${2:-}"; shift 2 ;;
    --schema) schema="${2:-}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$target" ]; then
  usage >&2
  exit 2
fi
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

restic restore "$snapshot" --host 027apps-supabase --target "$workdir"

dump="$(find "$workdir" -type f -name '*.dump' | head -n 1)"
if [ -z "$dump" ]; then
  echo "No .dump file found in snapshot ${snapshot}." >&2
  exit 1
fi
echo "Restoring $(basename "$dump") into ${target%%\?*}"

if [ "$schema" = "all" ]; then
  pg_restore --no-owner --dbname "$target" "$dump"
else
  pg_restore --no-owner --clean --if-exists --dbname "$target" \
    --schema "$schema" "$dump"
fi

tables="$(psql "$target" -Atc \
  "select count(*) from information_schema.tables
   where table_schema not in ('pg_catalog', 'information_schema')")"
echo "Restore finished. User tables in target: ${tables}"
