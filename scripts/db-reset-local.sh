#!/usr/bin/env bash
#
# The only sanctioned way to reset the local stack: dumps first, resets after,
# and tells you how to come back.
#
# `supabase db reset` deletes every local account, invitation and module row.
# That is fine when you meant it and expensive when something else ran it, so
# this wrapper makes the destructive command always leave a restore point.
#
# Usage: scripts/db-reset-local.sh [--no-backup] [extra supabase db reset flags]
#
# Production is out of reach by construction: it calls `supabase db reset`
# without --remote, and the linked project is only used by CI.

set -euo pipefail

cd "$(dirname "$0")/.."

backup=1
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --no-backup) backup=0; shift ;;
    *) args+=("$1"); shift ;;
  esac
done

if [ "${#args[@]}" -gt 0 ] && printf '%s ' "${args[@]}" | grep -qE -- '--remote|--linked|--db-url'; then
  echo "This wrapper never resets a remote database. Production changes only through CI." >&2
  exit 2
fi

dump=""
if [ "$backup" = "1" ]; then
  echo "== dump local before resetting"
  dump="$(scripts/db-local-backup.sh | sed -n 's/^backup: \([^ ]*\).*/\1/p')"
  if [ -z "$dump" ]; then
    echo "Could not create the safety dump; refusing to reset without one (use --no-backup to override)." >&2
    exit 1
  fi
fi

echo "== supabase db reset${args[*]+ ${args[*]}}"
npx supabase db reset ${args[@]+"${args[@]}"}

echo
if [ -n "$dump" ]; then
  echo "Reset done. To come back to the previous local data:"
  echo "  scripts/db-local-restore.sh $dump"
fi
