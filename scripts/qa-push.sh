#!/usr/bin/env bash
#
# Push pipeline smoke: proves the server enqueues the notification with the
# right target and channel, and reports how far it got (dispatcher, publish,
# failure). The last inch — FCM delivering to a phone — needs the release APK
# with google-services.json on a real device.
#
# Local (default): creates and deletes its own qa-push-*@test.local accounts and
# restores the levels it changes.
# Staging: pass BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL and
# QA_PUSH_MEMBER_EMAIL/PASSWORD + QA_PUSH_ADMIN_EMAIL/PASSWORD of existing users;
# it never creates users there.
#
# Usage: scripts/qa-push.sh [BASE_URL]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${1:-${BASE_URL:-http://127.0.0.1:3003}}"
ENV_FILE="$ROOT/apps/admin/.env.local"

LOCAL=1
case "$BASE_URL" in
  http://127.0.0.1:*|http://localhost:*|http://192.168.*|http://10.*) ;;
  *) LOCAL=0 ;;
esac

if [[ "$LOCAL" == "1" && -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi
SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
ANON_KEY="${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
DB_URL="${SUPABASE_DB_URL:-}"

if [[ -z "$SUPABASE_URL" || -z "$ANON_KEY" ]]; then
  printf 'SUPABASE_URL and SUPABASE_ANON_KEY are required\n'
  exit 2
fi

# The outbox lives in Postgres: psql with the DSN when there is one, otherwise
# the local container.
CONTAINER=""
if [[ -n "$DB_URL" ]] && command -v psql >/dev/null 2>&1; then
  PSQL_DSN="$DB_URL"
elif CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -m1 '^supabase_db_' || true)" && [[ -n "$CONTAINER" ]]; then
  PSQL_DSN=""
else
  printf 'no way to read the outbox: set SUPABASE_DB_URL (with psql) or run the local stack\n'
  exit 2
fi

sql() {
  if [[ -n "$PSQL_DSN" ]]; then
    psql "$PSQL_DSN" -qAt -F '|' -c "$1"
  else
    docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -F '|' -c "$1" < /dev/null
  fi
}

ADMIN_EMAIL="${QA_PUSH_ADMIN_EMAIL:-qa-push-admin@test.local}"
ADMIN_PASSWORD="${QA_PUSH_ADMIN_PASSWORD:-qa-push-admin-password}"
MEMBER_EMAIL="${QA_PUSH_MEMBER_EMAIL:-qa-push-member@test.local}"
MEMBER_PASSWORD="${QA_PUSH_MEMBER_PASSWORD:-qa-push-member-password}"

cleanup() {
  local code=$?
  if [[ "$LOCAL" == "1" ]]; then
    sql "delete from public.invitation_requests where requester_id in (
           select id from auth.users where email like 'qa-push-%@test.local');
         delete from public.invitations where created_by in (
           select id from auth.users where email like 'qa-push-%@test.local');
         delete from public.profiles where id in (
           select id from auth.users where email like 'qa-push-%@test.local');
         delete from auth.users where email like 'qa-push-%@test.local';" >/dev/null 2>&1 || true
    if [[ -n "${ORIGINAL_LEVELS:-}" ]]; then
      sql "update public.settings set value = '$ORIGINAL_LEVELS'::jsonb
            where key = 'invitations.levels'" >/dev/null 2>&1 || true
    fi
  fi
  exit "$code"
}
trap cleanup EXIT

code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/health" || true)"
if [[ "$code" != "200" ]]; then
  printf 'the instance does not answer at %s/api/v1/health (code %s)\n' "$BASE_URL" "$code"
  exit 2
fi

if [[ "$LOCAL" == "1" ]]; then
  # Read before the driver runs so the trap can restore it even if it fails.
  ORIGINAL_LEVELS="$(sql "select value::text from public.settings where key = 'invitations.levels'")"
fi

printf '== push pipeline against %s (%s)\n' "$BASE_URL" "$([[ "$LOCAL" == "1" ]] && echo local || echo remoto)"

python3 - "$BASE_URL" "$SUPABASE_URL" "$ANON_KEY" "$SERVICE_KEY" "$LOCAL" \
  "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$MEMBER_EMAIL" "$MEMBER_PASSWORD" "$PSQL_DSN" "$CONTAINER" <<'PY'
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

base, supabase, anon, service, local, admin_email, admin_password, member_email, member_password, dsn, container = sys.argv[1:12]
local = local == "1"
supabase = supabase.rstrip("/")
failures = []


def sql(statement):
    command = (["psql", dsn] if dsn else
               ["docker", "exec", container, "psql", "-U", "postgres", "-d", "postgres"])
    result = subprocess.run(command + ["-qAt", "-F", "|", "-c", statement],
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip()[:300])
    return result.stdout.strip()


def call(method, url, body=None, token=None, key=anon):
    data = None if body is None else json.dumps(body).encode()
    headers = {"apikey": key, "Authorization": f"Bearer {token or key}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
            return response.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, (json.loads(raw) if raw else None)
        except json.JSONDecodeError:
            return error.code, {"raw": raw.decode(errors="replace")[:200]}


def check(condition, message, detail=""):
    if condition:
        print(f"  ok   {message}")
    else:
        print(f"  FAIL {message}" + (f" — {detail}" if detail else ""))
        failures.append(message)


def code_of(payload):
    return (payload or {}).get("error", {}).get("code", "")


def sign_in(email, password):
    status, body = call("POST", f"{supabase}/auth/v1/token?grant_type=password",
                        {"email": email, "password": password})
    return (body or {}).get("access_token", "")


def create_user(email, password):
    status, body = call("POST", f"{supabase}/auth/v1/admin/users",
                        {"email": email, "password": password, "email_confirm": True},
                        key=service)
    if status >= 400:
        raise SystemExit(f"could not create {email}: {body}")
    return body["id"]


def outbox(event_type, request_id):
    rows = sql(
        "select coalesce(target,'-'), coalesce(notify::text,'-'), attempts, "
        "coalesce(published_at::text,'-'), coalesce(failed_at::text,'-'), "
        "coalesce(claimed_until::text,'-'), subject_id::text "
        "from public.event_outbox "
        f"where type = '{event_type}' and resource->>'request_id' = '{request_id}' "
        "order by created_at desc limit 1"
    )
    return rows.split("|") if rows else None


def devices_for_admin_tokens():
    return sql("select count(*) from public.devices d join public.profiles p on p.id = d.user_id "
               "where p.role in ('admin','super_admin') and d.revoked_at is null")


def describe(event, label):
    if not event:
        check(False, f"{label}: el evento no está en el outbox")
        return
    target, notify, attempts, published, failed, claimed, _subject = event
    check(notify.strip("{}").split(",") == ["push"],
          f"{label}: sale solo por push", notify)
    if published != "-":
        print(f"  ok   {label}: despachado por el servidor")
    elif failed != "-":
        check(False, f"{label}: el despachador lo dio por fallido", failed)
    elif attempts != "0":
        print(f"  ok   {label}: el despachador lo ha tomado ({attempts} intento(s))")
    else:
        print(f"  ok   {label}: encolado; el despachador todavía no lo ha tomado "
              f"(en local no hay worker de outbox)")
        print("       en staging, con el cron activo, aquí debe aparecer 'despachado'.")


print("\n-- preparar las cuentas")
if local:
    # Level 1 without seats forces the request path; restored on exit.
    sql("update public.settings set value = '[{\"level\":1,\"quota\":0}]'::jsonb "
        "where key = 'invitations.levels'")
    sql(f"delete from public.profiles where id in (select id from auth.users "
        f"where email in ('{admin_email}','{member_email}'))")
    sql(f"delete from auth.users where email in ('{admin_email}','{member_email}')")
    admin_id = create_user(admin_email, admin_password)
    member_id = create_user(member_email, member_password)
    sql("insert into public.profiles (id, display_name, role, invite_level, locale) values "
        f"('{admin_id}', 'QA Push Admin', 'super_admin', null, 'en'), "
        f"('{member_id}', 'QA Push Member', 'user', 1, 'en')")
else:
    admin_id = sql(f"select id from public.profiles where id = (select id from auth.users "
                   f"where email = '{admin_email}')")
    member_id = sql(f"select id from public.profiles where id = (select id from auth.users "
                    f"where email = '{member_email}')")

admin_token = sign_in(admin_email, admin_password)
member_token = sign_in(member_email, member_password)
check(bool(admin_token) and bool(member_token), "las dos sesiones abren")

status, own = call("GET", f"{base}/api/v1/me/invitations", token=member_token)
quota = (own or {}).get("quota") or {}
if quota.get("remaining", 0) > 0:
    print(f"  (el miembro tiene {quota.get('remaining')} plazas: se agota su cuota para probar)")
    if local:
        sql(f"update public.profiles set invite_level = 1 where id = '{member_id}'")
    else:
        print("  FAIL en remoto el miembro debe estar sin plazas de antemano")
        failures.append("member has seats")

print("\n-- el miembro pide y se avisa a los administradores")
status, asked = call("POST", f"{base}/api/v1/me/invitation-requests",
                     {"amount": 1, "reason": "push smoke"}, token=member_token)
check(status == 201, "la solicitud se crea", f"{status} {asked}")
request_id = ((asked or {}).get("request") or {}).get("id", "")

time.sleep(2)
requested = outbox("invitation.requested", request_id)
check(requested is not None, "invitation.requested está en el outbox", "sin evento")
if requested:
    check(requested[0] == "admins", "va dirigido a los administradores", requested[0])
describe(requested, "aviso al administrador")
tokens = devices_for_admin_tokens()
print(f"  {'ok  ' if tokens != '0' else 'aviso'} dispositivos activos de administradores: {tokens}"
      + ("" if tokens != "0" else " (sin token no hay a quién entregar)"))

print("\n-- el administrador aprueba y se avisa al miembro")
status, approved = call("POST", f"{base}/api/v1/invitation-requests/{request_id}/approve",
                        {"amount": 1}, token=admin_token)
check(status == 200, "la aprobación responde 200", f"{status} {approved}")
time.sleep(2)
resolved = outbox("invitation.request_resolved", request_id)
check(resolved is not None, "invitation.request_resolved está en el outbox", "sin evento")
if resolved:
    check(resolved[0] == "user", "va dirigido al miembro", resolved[0])
    describe(resolved, "aviso al miembro")

print("\nresumen: el servidor encola y despacha lo que puede; la entrega al móvil "
      "se comprueba con el APK release y un dispositivo real.")
if failures:
    print(f"\n{len(failures)} comprobación(es) fallida(s)")
    sys.exit(1)
print("todo en verde")
PY

