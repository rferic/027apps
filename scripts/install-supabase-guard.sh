#!/usr/bin/env bash
#
# Installs the Supabase CLI tripwire in the two places a command can find it:
#
#   1. ~/.local/bin/supabase      — PATH callers (watchers, scripts, terminals)
#   2. node_modules/.bin/supabase — `npx supabase`, which prefers the local bin
#
# Both point at scripts/shims/supabase: logs every invocation and refuses
# `db reset` without SUPABASE_ALLOW_LOCAL_RESET=1. Idempotent, and removable with
# `scripts/install-supabase-guard.sh --remove`.
#
# It is a machine-level convenience, not a repo dependency: a fresh clone works
# without it, it only makes an accidental reset impossible and traceable.

set -euo pipefail

cd "$(dirname "$0")/.."

shim="$PWD/scripts/shims/supabase"
user_shim="$HOME/.local/bin/supabase"
local_shim="node_modules/.bin/supabase"

if [ "${1:-}" = "--remove" ]; then
  rm -f "$user_shim"
  [ -L "$local_shim" ] && rm -f "$local_shim"
  echo "removed the Supabase tripwire (PATH and node_modules/.bin)"
  exit 0
fi

[ -x "$shim" ] || { echo "missing $shim" >&2; exit 2; }

mkdir -p "$HOME/.local/bin"
cp "$shim" "$user_shim"
chmod +x "$user_shim"

mkdir -p node_modules/.bin
ln -sf "$shim" "$local_shim"

echo "installed:"
echo "  $user_shim"
echo "  $local_shim -> $shim"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "warning: ~/.local/bin is not in PATH; the PATH tripwire will not be reached" >&2 ;;
esac

echo
echo "check:    supabase --version   (logged, passes through)"
echo "blocked:  supabase db reset   (logs the caller and refuses)"
echo "allowed:  pnpm db:reset       (dump first, then reset)"
echo "remove:   scripts/install-supabase-guard.sh --remove"
