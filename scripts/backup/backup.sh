#!/usr/bin/env bash
#
# Dumps the Supabase Postgres database and uploads it to an encrypted restic
# repository hosted outside Supabase. Runs in .github/workflows/backup.yml and,
# with the same environment variables, from a laptop (see docs/infrastructure.md).
#
# Required environment:
#   SUPABASE_DB_URL    Postgres connection string (session pooler, IPv4)
#   RESTIC_REPOSITORY  e.g. s3:https://<account>.r2.cloudflarestorage.com/<bucket>/027apps
#   RESTIC_PASSWORD    repository passphrase (never commit it)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  S3 credentials scoped to that bucket
#
set -euo pipefail
umask 077

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

# Fixed host tag so retention does not fragment across ephemeral CI runners.
HOST_TAG="027apps-supabase"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
dump="$workdir/027apps.dump"

echo "pg_dump: $(pg_dump --version)"
pg_dump --format=custom --no-owner --file "$dump" "$SUPABASE_DB_URL"

echo "Dump size: $(wc -c < "$dump" | tr -d ' ') bytes"

# Cheap integrity check: a truncated archive fails to list its TOC.
pg_restore --list "$dump" > /dev/null

if ! restic snapshots > /dev/null 2>&1; then
  echo "Initialising restic repository at ${RESTIC_REPOSITORY}"
  restic init
fi

restic backup --host "$HOST_TAG" --tag postgres "$dump"

# 7 daily / 4 weekly / 12 monthly, then drop unreferenced packs.
restic forget --host "$HOST_TAG" --group-by host \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune

restic check

echo "Latest snapshots:"
restic snapshots --host "$HOST_TAG" --latest 1
