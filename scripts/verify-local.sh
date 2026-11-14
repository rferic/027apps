#!/usr/bin/env bash
#
# Pre-delivery verification against the local instance.
#
# What it proves, with evidence instead of assumptions:
#   1. Every installed module is whole: registry row, schema with tables and
#      its migrations. A row whose schema was never applied is a broken
#      install and fails here, not in front of the owner's browser.
#   2. Every panel page the installed modules ship answers 200 with a real
#      session, and the body carries no runtime error.
#   3. The Core and module APIs answer with that session.
#
# It uses a temporary local admin (`qa-verify@test.local`) and removes it on
# exit. Local only: it refuses any Supabase URL that is not loopback/LAN dev.
#
# Usage:
#   scripts/verify-local.sh [BASE_URL] [route ...]
#   BASE_URL defaults to http://127.0.0.1:3003.
#
# Reading and running it is part of docs/flows/pre-delivery-verification.md.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/admin/.env.local"
BASE_URL="${BASE_URL:-${1:-http://127.0.0.1:3003}}"
if [[ $# -gt 0 ]]; then shift; fi
EXTRA_ROUTES=("$@")

QA_EMAIL="qa-verify@test.local"
QA_PASSWORD="qa-verify-local-027apps"
WORK="$(mktemp -d)"
FAILURES=0
COOKIE_FILE="$WORK/cookie"
TOKEN_FILE="$WORK/token"

say() { printf '%s\n' "$*"; }
pass() { say "  ok   $*"; }
fail() { say "  FAIL $*"; FAILURES=$((FAILURES + 1)); }

cleanup() {
  local code=$?
  if [[ -n "${CONTAINER:-}" ]]; then
    docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -c \
      "delete from public.profiles where id = (select id from auth.users where email = '$QA_EMAIL');
       delete from auth.users where email = '$QA_EMAIL';" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
  exit "$code"
}
trap cleanup EXIT

require() {
  command -v "$1" >/dev/null 2>&1 || {
    say "missing $1"
    exit 2
  }
}
require curl
require python3
require docker

[[ -f "$ENV_FILE" ]] || {
  say "missing $ENV_FILE (the local admin env)"
  exit 2
}
# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:?}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:?}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?}"

case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*|http://192.168.*|http://10.*) ;;
  *)
    say "refusing to verify against a non-local Supabase: $SUPABASE_URL"
    exit 2
    ;;
esac

CONTAINER="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
[[ -n "$CONTAINER" ]] || {
  say "no supabase_db_* container running (start the local stack first)"
  exit 2
}
# No `-i`: the loop below feeds stdin, and an attached stdin would swallow the
# remaining rows of a process substitution.
sql() { docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -F $'\t' -c "$1" < /dev/null; }

say "== instance $BASE_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/login" || true)"
if [[ "$code" == "200" ]]; then pass "/login answers 200"; else fail "/login answers $code (dev server down?)"; fi

say "== installed modules are whole"
broken=0
while IFS=$'\t' read -r key state version; do
  [[ -n "$key" ]] || continue
  schema="module_$(printf '%s' "$key" | tr '-' '_')"
  tables="$(sql "select count(*) from information_schema.tables where table_schema = '$schema'")"
  migrations="$(sql "select count(*) from public.module_migrations where module_key = '$key' and direction = 'up'")"
  if [[ "$tables" == "0" ]]; then
    fail "$key is $state at $version but $schema has no tables"
    broken=1
    continue
  fi
  if [[ "$migrations" == "0" ]]; then
    fail "$key is $state at $version but has no applied migrations"
    broken=1
    continue
  fi
  pass "$key $version $state: $tables tables, $migrations migrations"
done < <(sql "select key, state, version from public.module_registry order by key")
if [[ "$broken" == "1" ]]; then
  say ""
  say "A module row without its schema is a failed install: reinstall it"
  say "(see docs/flows/pre-delivery-verification.md) before touching the panel."
fi

say "== panel and API with a real session"
python3 - "$SUPABASE_URL" "$ANON_KEY" "$SERVICE_KEY" "$QA_EMAIL" "$QA_PASSWORD" \
  "$COOKIE_FILE" "$TOKEN_FILE" <<'PY'
import base64, json, os, sys, urllib.error, urllib.request

url, anon, service, email, password, cookie_file, token_file = sys.argv[1:8]


def post(path, body, key):
    req = urllib.request.Request(
        url + path,
        data=json.dumps(body).encode(),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        return {"error": error.read().decode()}


created = post(
    "/auth/v1/admin/users",
    {"email": email, "password": password, "email_confirm": True},
    service,
)
if "error" in created and "already" not in created["error"]:
    sys.exit("could not create the QA admin: " + created["error"][:200])

session = post("/auth/v1/token?grant_type=password", {"email": email, "password": password}, anon)
if "access_token" not in session:
    sys.exit("could not sign in the QA admin: " + str(session)[:200])

payload = json.dumps(session, separators=(",", ":")).encode()
value = "base64-" + base64.urlsafe_b64encode(payload).decode().rstrip("=")
name = "sb-" + url.split("//")[1].split(":")[0].split(".")[0] + "-auth-token"
chunks = [value[i : i + 3180] for i in range(0, len(value), 3180)]
if len(chunks) == 1:
    cookie = f"{name}={chunks[0]}"
else:
    cookie = "; ".join(f"{name}.{i}={chunk}" for i, chunk in enumerate(chunks))
with open(cookie_file, "w") as handle:
    handle.write(cookie)
with open(token_file, "w") as handle:
    handle.write(session["access_token"])
with open(cookie_file + ".user", "w") as handle:
    handle.write(session["user"]["id"])
PY

QA_ID="$(cat "$COOKIE_FILE.user")"
sql "insert into public.profiles (id, display_name, role)
     values ('$QA_ID', 'QA Verify', 'super_admin')
     on conflict (id) do update set role = 'super_admin'" >/dev/null

routes=(/panel /panel/modules)
for key in $(sql "select key from public.module_registry order by key"); do
  routes+=("/panel/modules/$key")
  manifest="$ROOT/packages/$key/manifest.json"
  if [[ -f "$manifest" ]]; then
    while read -r page; do
      [[ -n "$page" ]] || continue
      if [[ "$page" == "overview" ]]; then continue; fi
      routes+=("/panel/modules/$key/$page")
    done < <(python3 -c 'import json,sys; print("\n".join(p["route"] for p in json.load(open(sys.argv[1])).get("admin_pages", [])))' "$manifest")
  fi
done
routes+=(${EXTRA_ROUTES[@]+"${EXTRA_ROUTES[@]}"})

for route in "${routes[@]}"; do
  body="$WORK/page.html"
  code="$(curl -s -o "$body" -w '%{http_code}' -H "Cookie: $(cat "$COOKIE_FILE")" "$BASE_URL$route" || true)"
  if [[ "$code" != "200" ]]; then
    fail "$route answers $code"
    continue
  fi
  if grep -qE 'Runtime error|Application error|does not exist' "$body"; then
    fail "$route rendered an error: $(grep -oE 'Runtime error|Application error|relation \"[^\"]+\" does not exist' "$body" | head -1)"
    continue
  fi
  pass "$route 200"
done

token="$(cat "$TOKEN_FILE")"
for api in /api/v1/me /api/v1/modules; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$BASE_URL$api" || true)"
  if [[ "$code" == "200" ]]; then pass "$api 200"; else fail "$api answers $code"; fi
done

if [[ -d "$ROOT/packages/owe-no" ]] && [[ "$(sql "select count(*) from public.module_registry where key = 'owe-no'")" == "1" ]]; then
  for api in /api/v1/owe-no/groups; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$BASE_URL$api" || true)"
    if [[ "$code" == "200" ]]; then pass "$api 200"; else fail "$api answers $code"; fi
  done
fi

say ""
if [[ "$FAILURES" -gt 0 ]]; then
  say "FAILED: $FAILURES check(s) need a fix before handing this over."
  exit 1
fi
say "All local checks passed."
