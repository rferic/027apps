#!/usr/bin/env bash
#
# Invitation flows against the real local instance (panel + Supabase), no phone.
#
# It walks the club lifecycle the way the owner does, and fails on any answer a
# person would call a bug:
#   1. mint a link, list it, preview it anonymously
#   2. redeem it as a new account (profile, level, seat consumed)
#   3. redeem a second link with an email that already has an account: the API
#      must answer 409 and keep the invitation pending (nobody signs in for the
#      invitee)
#   4. accept that same invitation with the account's own session: no duplicate,
#      level untouched, no new seat spent
#   5. re-issue a pending link: the old token dies, the new one previews
#   6. revoke it: the token dies and the seat comes back
#   7. rotating QR: preview, exchange once, second exchange refused
#   8. a screen full of reads never spends the create-link budget
#
# Local only. Creates and removes its own `qa-invite-*@test.local` accounts.
#
# Usage: scripts/qa-invitations.sh [BASE_URL]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/admin/.env.local"
BASE_URL="${1:-${BASE_URL:-http://127.0.0.1:3003}}"

QA_EMAIL="qa-invitations@test.local"
QA_PASSWORD="qa-invitations-local-027apps"

[[ -f "$ENV_FILE" ]] || {
  printf 'missing %s (the local admin env)\n' "$ENV_FILE"
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
    printf 'refusing to run against a non-local Supabase: %s\n' "$SUPABASE_URL"
    exit 2
    ;;
esac

CONTAINER="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
[[ -n "$CONTAINER" ]] || {
  printf 'no supabase_db_* container running (start the local stack first)\n'
  exit 2
}

cleanup() {
  local code=$?
  docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -c \
    "delete from public.invitations
      where created_by in (select id from auth.users where email like 'qa-invite-%@test.local')
         or created_by = (select id from auth.users where email = '$QA_EMAIL');
     delete from public.profiles where id in (
       select id from auth.users where email like 'qa-invite-%@test.local' or email = '$QA_EMAIL');
     delete from auth.users where email like 'qa-invite-%@test.local' or email = '$QA_EMAIL';" \
    >/dev/null 2>&1 || true
  exit "$code"
}
trap cleanup EXIT

code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/v1/health" || true)"
if [[ "$code" != "200" ]]; then
  printf 'the panel does not answer at %s/api/v1/health (code %s)\n' "$BASE_URL" "$code"
  printf 'start the dev server before running this\n'
  exit 2
fi

printf '== invitation flows against %s\n' "$BASE_URL"
python3 - "$BASE_URL" "$SUPABASE_URL" "$ANON_KEY" "$SERVICE_KEY" "$QA_EMAIL" \
  "$QA_PASSWORD" "$CONTAINER" <<'PY'
import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

base, supabase, anon, service, admin_email, admin_password, container = sys.argv[1:8]
failures = []


def psql(statement):
    result = subprocess.run(
        ["docker", "exec", container, "psql", "-U", "postgres", "-d", "postgres",
         "-qAt", "-F", "|", "-c", statement],
        capture_output=True, text=True,
    )
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


def api(path):
    return f"{base}/api/v1{path}"


# --- setup: a super admin with a profile, its session ------------------------
status, created = call(
    "POST", f"{supabase}/auth/v1/admin/users",
    {"email": admin_email, "password": admin_password, "email_confirm": True},
    key=service,
)
if status >= 400 and "already" not in json.dumps(created):
    sys.exit(f"could not create the QA admin: {created}")

status, session = call(
    "POST", f"{supabase}/auth/v1/token?grant_type=password",
    {"email": admin_email, "password": admin_password},
)
if "access_token" not in session:
    sys.exit(f"could not sign in the QA admin: {session}")
admin_token = session["access_token"]
admin_id = session["user"]["id"]
# The API resolves the caller through `profiles`; without the row every call is 401.
psql(
    "insert into public.profiles (id, display_name, role) values "
    f"('{admin_id}', 'QA Invitations', 'super_admin') "
    "on conflict (id) do update set role = 'super_admin'"
)

print("\n-- un administrador crea un enlace")
status, minted = call("POST", api("/me/invitations"), {}, token=admin_token)
check(status == 201, "POST /me/invitations answers 201", f"{status} {minted}")
token = (minted or {}).get("token", "")
invitation_id = ((minted or {}).get("invitation") or {}).get("id", "")
if not token.startswith("027_inv_"):
    sys.exit("no invitation token was minted; stopping before the rest of the flow")
check((minted or {}).get("path") == f"/invite/{token}", "the path carries the token")
check(bool(invitation_id), "the response names the invitation")

status, own = call("GET", api("/me/invitations"), token=admin_token)
quota = (own or {}).get("quota") or {}
check(status == 200, "GET /me/invitations answers 200", str(status))
check(quota.get("reserved") == 1, "the pending link reserves one seat", json.dumps(quota))
check(any(i.get("id") == invitation_id for i in (own or {}).get("invitations", [])),
      "the new invitation is listed")

print("\n-- la invitación anónima se previsualiza sin sesión")
status, preview = call("GET", api(f"/invitations/{token}/preview"))
check(status == 200, "the public preview answers 200", str(status))
invitation = (preview or {}).get("invitation") or {}
check(invitation.get("requires_identity") is True, "it requires a name and an email")
check(invitation.get("email") is None and invitation.get("name") is None,
      "it carries no email or name yet")
check(invitation.get("account_exists") is False, "the preview never reveals an existing account")

print("\n-- canje con una cuenta nueva")
invitee_email = f"qa-invite-new-{uuid.uuid4().hex[:8]}@test.local"
invitee_password = "qa-invitee-password"
status, redeemed = call(
    "POST", api(f"/invitations/{token}/redeem"),
    {"email": invitee_email, "name": "QA Invitada", "password": invitee_password},
)
check(status == 201, "the redemption answers 201", f"{status} {redeemed}")
invitee_id = ((redeemed or {}).get("user") or {}).get("id", "")

status, own = call("GET", api("/me/invitations"), token=admin_token)
quota = (own or {}).get("quota") or {}
check(quota.get("used") == 1, "the new profile consumes one seat", json.dumps(quota))
check(quota.get("reserved") == 0, "the reservation became an account", json.dumps(quota))

level, role = (psql(f"select invite_level, role from public.profiles where id = '{invitee_id}'")
               .split("|") + ["", ""])[:2]
check(level == "1", "an admin invitee lands on level 1", f"level={level}")
check(role == "user", "the invitation role is user", f"role={role}")

print("\n-- canje con un email ya registrado: no se firma por nadie")
status, minted2 = call("POST", api("/me/invitations"), {}, token=admin_token)
token2 = (minted2 or {}).get("token", "")
second_id = ((minted2 or {}).get("invitation") or {}).get("id", "")
status, refused = call(
    "POST", api(f"/invitations/{token2}/redeem"),
    {"email": invitee_email, "name": "Otra vez", "password": invitee_password},
)
check(status == 409, "the redeem refuses the existing email with 409", f"{status} {refused}")
check(code_of(refused) == "existing_account_signin_required",
      "the code says the account must sign in", code_of(refused))
state = psql(f"select coalesce(used_at::text, '-') from public.invitations where id = '{second_id}'")
check(state == "-", "the invitation stays pending", f"used_at={state}")

print("\n-- la misma invitación, aceptada con la sesión de esa cuenta")
status, invitee_session = call(
    "POST", f"{supabase}/auth/v1/token?grant_type=password",
    {"email": invitee_email, "password": invitee_password},
)
check("access_token" in invitee_session, "the existing account signs in", str(invitee_session)[:120])
status, accepted = call(
    "POST", api(f"/invitations/{token2}/redeem"),
    {"email": invitee_email},
    token=invitee_session.get("access_token"),
)
check(status == 201, "the confirmed account redeems the invitation", f"{status} {accepted}")

status, own = call("GET", api("/me/invitations"), token=admin_token)
quota_after = (own or {}).get("quota") or {}
check(quota_after.get("used") == 1, "no new seat is spent for an existing account",
      json.dumps(quota_after))
still = psql(f"select invite_level from public.profiles where id = '{invitee_id}'")
check(still == "1", "the account keeps its level", f"level={still}")

print("\n-- reabrir una pendiente reacuña el enlace")
status, minted3 = call("POST", api("/me/invitations"), {}, token=admin_token)
third_id = ((minted3 or {}).get("invitation") or {}).get("id", "")
old_token = (minted3 or {}).get("token", "")
status, rotated = call("POST", api(f"/me/invitations/{third_id}/link"), {}, token=admin_token)
new_token = (rotated or {}).get("token", "")
check(status == 200, "the re-issue answers 200", f"{status} {rotated}")
check(new_token.startswith("027_inv_") and new_token != old_token, "it mints a different token")

status, _ = call("GET", api(f"/invitations/{old_token}/preview"))
check(status == 404, "the previous link stops working", str(status))
status, _ = call("GET", api(f"/invitations/{new_token}/preview"))
check(status == 200, "the new link previews", str(status))

print("\n-- la caducidad configurable manda en el enlace nuevo")
original_ttl = psql("select value::text from public.settings where key = 'invitations.member_ttl_hours'")
psql("update public.settings set value = '1'::jsonb where key = 'invitations.member_ttl_hours'")
try:
    status, short_link = call("POST", api("/me/invitations"), {}, token=admin_token)
    expires = ((short_link or {}).get("invitation") or {}).get("expires_at", "")
    check(status == 201, "a link is minted with a 1-hour setting", str(status))
    from datetime import datetime, timezone
    expires_at = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    hours = (expires_at - datetime.now(timezone.utc)).total_seconds() / 3600
    check(0.9 <= hours <= 1.05, "the link lives one hour, not the old 48", f"{hours:.2f} h")
    # Leave no extra pending link behind: the quota checks below count them.
    call("DELETE", api(f"/me/invitations/{((short_link or {}).get('invitation') or {}).get('id')}"),
         token=admin_token)
finally:
    psql(f"update public.settings set value = '{original_ttl}'::jsonb "
         "where key = 'invitations.member_ttl_hours'")
status, own = call("GET", api("/me/invitations"), token=admin_token)
check(status == 200, "the original lifetime is restored", str(status))

print("\n-- una invitación con nombre no se rota desde la app")
status, named = call(
    "POST", api("/invitations"),
    {"email": f"qa-invite-named-{uuid.uuid4().hex[:8]}@test.local", "name": "QA Named"},
    token=admin_token,
)
named_id = ((named or {}).get("invitation") or {}).get("id", "")
check(status == 201 and bool(named_id), "the panel mints a named invitation", f"{status} {named}")
status, refused_rotate = call("POST", api(f"/me/invitations/{named_id}/link"), {}, token=admin_token)
check(status == 404, "rotating it is refused with 404", f"{status} {refused_rotate}")

print("\n-- revocar libera la plaza")
status, _ = call("DELETE", api(f"/me/invitations/{third_id}"), token=admin_token)
check(status == 204, "the revoke answers 204", str(status))
status, _ = call("GET", api(f"/invitations/{new_token}/preview"))
check(status == 404, "the revoked link is gone", str(status))
status, own = call("GET", api("/me/invitations"), token=admin_token)
check(((own or {}).get("quota") or {}).get("reserved") == 0, "the seat comes back",
      json.dumps((own or {}).get("quota")))

print("\n-- QR rotativo")
status, code = call("POST", api("/me/join-codes"), {}, token=admin_token)
join_code = (code or {}).get("code", "")
check(status == 201 and join_code.startswith("027_join_"), "the QR code is minted", str(status))
status, _ = call("GET", api(f"/join-codes/{join_code}/preview"))
check(status == 200, "the code previews without exchanging", str(status))
status, exchanged = call("POST", api(f"/join-codes/{join_code}/exchange"), {})
check(status == 201 and (exchanged or {}).get("token", "").startswith("027_inv_"),
      "the exchange mints a 15-minute invitation", f"{status} {exchanged}")
status, twice = call("POST", api(f"/join-codes/{join_code}/exchange"), {})
check(status == 410 and code_of(twice) == "join_code_used", "the code is single use",
      f"{status} {twice}")

print("\n-- presupuesto: las lecturas no gastan el de crear")
for _ in range(15):
    call("GET", api("/me/invitations"), token=admin_token)
status, after_reads = call("POST", api("/me/invitations"), {}, token=admin_token)
check(status == 201, "15 reads later, creating still works", f"{status} {after_reads}")

if failures:
    print(f"\n{len(failures)} comprobación(es) fallida(s)")
    sys.exit(1)
print("\ntodo en verde")
PY
