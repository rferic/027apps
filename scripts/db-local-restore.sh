#!/usr/bin/env bash
#
# Restores a dump made by `scripts/db-local-backup.sh` into the local Supabase
# database. It cleans the local schema first, so it asks for `--yes` when the
# target is not local — which cannot happen here unless the container name is
# forged, but the check keeps the rule in one place.
#
# Usage: scripts/db-local-restore.sh <dump> [--yes]

set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  sed -n '2,12p' "$0" >&2
  exit 2
fi

file="$1"
shift || true
confirmed=0
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) confirmed=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[ -f "$file" ] || { echo "No such dump: $file" >&2; exit 2; }

container="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
if [ -z "$container" ]; then
  echo "No supabase_db_* container running. Start the local stack first (supabase start)." >&2
  exit 2
fi
if [ "$confirmed" != "1" ] && [ "${container#supabase_db_}" = "$container" ]; then
  echo "Refusing to restore into ${container}: not a local Supabase container." >&2
  exit 2
fi

echo "restoring $(basename "$file") into $container"
# The schema comes from the migrations (`supabase db reset` already applied
# them), so only the rows are restored. The two product schemas are emptied
# first: the dump is a point in time, and merging it with whatever the reset
# seeded produced duplicate-key errors. Migration bookkeeping lives in
# `supabase_migrations`, so the applied version is untouched.
# `supabase_admin` is the image's superuser (`auth.users` belongs to
# `supabase_auth_admin`) and `--disable-triggers` keeps FKs out of the way.
echo "emptying public and auth, then loading the dump"
docker exec -i "$container" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare r record;
begin
  for r in
    select format('truncate table %I.%I cascade', table_schema, table_name) as cmd
      from information_schema.tables
     where table_schema in ('public', 'auth')
       and table_type = 'BASE TABLE'
  loop
    execute r.cmd;
  end loop;
end $$;
SQL

docker exec -i "$container" pg_restore -U supabase_admin -d postgres \
  --data-only --disable-triggers --no-owner --no-privileges \
  --schema=public --schema=auth \
  < "$file"

echo "restored. Restart the API so PostgREST reloads its schema cache:"
echo "  npx supabase stop && npx supabase start   (or just reload the app)"
