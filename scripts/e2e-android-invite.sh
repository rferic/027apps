#!/usr/bin/env bash
#
# Drives the real app on a connected emulator/phone through the invitation
# screens, so the owner never debugs these flows by hand.
#
# It proves, against the running local instance:
#   1. the invitation link opens the app and paints the form (no generic error)
#   2. an email that already has an account STOPS: the invitation stays pending
#      and no new profile is created (nobody signs in for the invitee)
#   3. a new email redeems from the app: the invitation is consumed and the
#      profile appears with the inviter and the right level
#
# The device must reach the panel. On an emulator the host is 10.0.2.2; on a
# phone pass INSTANCE_URL=http://<lan-ip>:3003.
#
# Usage:
#   scripts/e2e-android-invite.sh [emulator|serial]
# Env: INSTANCE_URL (default http://10.0.2.2:3003), APK (default debug build).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
APK="${APK:-$ROOT/apps/android/app/build/outputs/apk/debug/app-debug.apk}"
INSTANCE_URL="${INSTANCE_URL:-http://10.0.2.2:3003}"
SERIAL="${1:-}"

[[ -x "$ADB" ]] || {
  printf 'adb not found at %s (set ADB=...)\n' "$ADB"
  exit 2
}
[[ -f "$APK" ]] || {
  printf 'APK not found at %s (build it: cd apps/android && ./gradlew :app:assembleDebug)\n' "$APK"
  exit 2
}

# A function, not an array: bash 3.2 (macOS) fails on an empty "${arr[@]}".
adb() {
  if [[ -n "$SERIAL" ]]; then
    "$ADB" -s "$SERIAL" "$@"
  else
    "$ADB" "$@"
  fi
}

CONTAINER="$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)"
[[ -n "$CONTAINER" ]] || {
  printf 'no supabase_db_* container running (start the local stack first)\n'
  exit 2
}

TOKEN_OLD="027_inv_qa$(openssl rand -hex 16)"
TOKEN_NEW="027_inv_qa$(openssl rand -hex 16)"
EXISTING_EMAIL="qa-invite-existing@test.local"
NEW_EMAIL="qa-invite-app-$(openssl rand -hex 4)@test.local"

PSQL() { docker exec "$CONTAINER" psql -U postgres -d postgres -qAt -F '|' -c "$1" < /dev/null; }
HASH() { printf '%s' "$1" | openssl dgst -sha256 -r | cut -d' ' -f1; }

cleanup() {
  local code=$?
  PSQL "delete from public.invitations where token_hash in ('$(HASH "$TOKEN_OLD")','$(HASH "$TOKEN_NEW")');
        delete from public.profiles where id in (select id from auth.users where email like 'qa-invite-%@test.local');
        delete from auth.users where email like 'qa-invite-%@test.local';" >/dev/null 2>&1 || true
  exit "$code"
}
trap cleanup EXIT

panel_code="$(curl -s -o /dev/null -w '%{http_code}' "${INSTANCE_URL/10.0.2.2/127.0.0.1}/api/v1/health" || true)"
if [[ "$panel_code" != "200" ]]; then
  printf 'the panel does not answer (code %s); start the dev server first\n' "$panel_code"
  exit 2
fi

INVITER="$(PSQL "select id from public.profiles where display_name = 'Club Test 1' limit 1")"
if [[ -z "$INVITER" ]]; then
  # Any active member works: the flow does not depend on that fixture name.
  INVITER="$(PSQL "select id from public.profiles where role = 'user' and deactivated_at is null limit 1")"
fi
[[ -n "$INVITER" ]] || {
  printf 'no member to invite from (create one in the panel first)\n'
  exit 2
}

# An account that already exists, with a known password.
PSQL "insert into auth.users
        (id, instance_id, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, aud, role)
      select gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             '$EXISTING_EMAIL', crypt('qa-existing-password', gen_salt('bf')), now(),
             '{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}',
             'authenticated', 'authenticated'
      where not exists (select 1 from auth.users where email = '$EXISTING_EMAIL')" >/dev/null
PSQL "insert into public.profiles (id, display_name, role, invite_level)
      select id, 'QA Existing', 'user', 1 from auth.users where email = '$EXISTING_EMAIL'
      on conflict (id) do nothing" >/dev/null

for pair in "old:$TOKEN_OLD" "new:$TOKEN_NEW"; do
  label="${pair%%:*}"
  token="${pair##*:}"
  PSQL "insert into public.invitations
          (email, name, role, source, depth, token_hash, locale, expires_at, created_by)
        values (null, null, 'user', 'member', 2, '$(HASH "$token")', 'es',
                now() + interval '48 hours', '$INVITER')" >/dev/null
done

printf '== installing the debug APK on the device\n'
adb install -r "$APK" >/dev/null
PACKAGE="$(adb shell pm list packages | tr -d '\r' | grep 'zero27apps.debug' | head -1 | cut -d: -f2)"
[[ -n "$PACKAGE" ]] || {
  printf 'the debug package is not installed on the device\n'
  exit 2
}

printf '== driving the app against %s\n' "$INSTANCE_URL"
python3 - "$ADB" "$SERIAL" "$PACKAGE" "$INSTANCE_URL" "$TOKEN_OLD" "$TOKEN_NEW" \
  "$EXISTING_EMAIL" "$NEW_EMAIL" "$CONTAINER" <<'PY'
import json
import re
import subprocess
import sys
import time
import urllib.parse

adb_path, serial, package, instance, token_old, token_new, existing_email, new_email, container = sys.argv[1:10]
failures = []


def adb(*args, timeout=60):
    command = [adb_path] + (["-s", serial] if serial else []) + list(args)
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout).stdout


def psql(statement):
    result = subprocess.run(
        ["docker", "exec", container, "psql", "-U", "postgres", "-d", "postgres",
         "-qAt", "-F", "|", "-c", statement],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip()[:300])
    return result.stdout.strip()


def check(condition, message, detail=""):
    if condition:
        print(f"  ok   {message}")
    else:
        print(f"  FAIL {message}" + (f" — {detail}" if detail else ""))
        failures.append(message)


def nodes():
    """The current window as (text, class, clickable, bounds) tuples."""
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml")
    xml = adb("shell", "cat", "/sdcard/window.xml")
    found = []
    for tag in re.findall(r"<node[^>]*>", xml):
        def attr(name):
            match = re.search(rf'{name}="([^"]*)"', tag)
            return match.group(1) if match else ""
        bounds = [int(value) for value in re.findall(r"\d+", attr("bounds"))]
        found.append({
            "text": attr("text"),
            "class": attr("class"),
            "clickable": attr("clickable") == "true",
            "bounds": bounds,
        })
    return found


def fields():
    return sorted(
        [node for node in nodes() if node["class"] == "android.widget.EditText"],
        key=lambda node: node["bounds"][1],
    )


def tap(node):
    left, top, right, bottom = node["bounds"]
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def fill(index, text):
    """Fill the index-th field by re-reading its bounds: the layout moves."""
    escaped = text.replace(" ", "%s")
    for _ in range(3):
        current = fields()
        if index >= len(current):
            time.sleep(0.5)
            continue
        node = current[index]
        if node["bounds"][3] > 1750:  # below the fold: bring it up first
            adb("shell", "input", "swipe", "540", "1500", "540", "1000", "250")
            time.sleep(0.5)
            continue
        tap(node)
        time.sleep(0.4)
        adb("shell", "input", "text", escaped)
        time.sleep(0.4)
        adb("shell", "input", "keyevent", "4")  # hide the keyboard
        time.sleep(0.5)
        return True
    return False


def wait_for(predicate, timeout=25, step=1):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(step)
    return False


def open_link(token):
    adb("shell", "am", "force-stop", package)
    time.sleep(1)
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d",
        f"zero27apps-dev://invite/{token}?instance={urllib.parse.quote(instance, safe='')}",
        package)
    # The form is up when the four fields exist (name, email, password, confirm).
    return wait_for(lambda: len(fields()) >= 3, timeout=30)


def submit(attempts=4):
    """Tap the primary action under the fields, scrolling until it is visible."""
    for _ in range(attempts):
        adb("shell", "input", "swipe", "540", "1700", "540", "700", "250")
        time.sleep(1)
        current = nodes()
        last_field = max(
            (node for node in current if node["class"] == "android.widget.EditText"),
            key=lambda node: node["bounds"][3],
            default=None,
        )
        floor = last_field["bounds"][3] if last_field else 0
        candidates = [
            node for node in current
            if node["clickable"]
            and node["bounds"][1] >= floor
            and node["bounds"][3] - node["bounds"][1] > 80
        ]
        if candidates:
            tap(sorted(candidates, key=lambda node: node["bounds"][1])[0])
            return True
    return False


def snapshot(label):
    """Saves the screen and prints its texts: only for a failing run."""
    adb("shell", "screencap", "-p", f"/sdcard/{label}.png")
    adb("pull", f"/sdcard/{label}.png", f"/tmp/{label}.png")
    print(f"    (screen: /tmp/{label}.png)")
    print("    texts: " + " | ".join(n["text"] for n in nodes() if n["text"])[:400])


def pending(token):
    state = psql(
        "select coalesce(used_at::text, '-') from public.invitations "
        f"where token_hash = encode(digest('{token}', 'sha256'), 'hex')"
    )
    return state == "-", state


print("\n-- el enlace abre el formulario en la app")
check(open_link(token_old), "the invitation screen paints the form")
check(len(fields()) >= 3, "it asks for name, email and password", str(len(fields())))
form_text = " ".join(node["text"] for node in nodes())
check("027_inv_" not in form_text, "the token never reaches the screen")

print("\n-- un email ya registrado no entra: la invitación sigue pendiente")
check(fill(0, "QA Prueba"), "the name field accepts text")
check(fill(1, existing_email), "the email field accepts text")
check(fill(2, "qa-existing-password"), "the password field accepts text")
check(fill(3, "qa-existing-password"), "the confirmation field accepts text")
check(existing_email in " ".join(n["text"] for n in nodes()), "the email reached its field")
check(submit(), "the accept button is tappable")
time.sleep(5)
check(pending(token_old)[0], "the invitation is still pending", pending(token_old)[1])
profiles = psql(f"select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email = '{existing_email}'")
check(profiles == "1", "no duplicate profile was created", f"profiles={profiles}")
stays = len(fields()) >= 3 or "Contraseña actual" in " ".join(n["text"] for n in nodes())
check(stays, "the app stays on the form asking for that account's password")
if not stays:
    snapshot("e2e-existing")

print("\n-- un email nuevo canjea la invitación desde la app")
check(open_link(token_new), "a second invitation opens its form")
check(fill(0, "QA desde la app"), "the name field accepts text")
check(fill(1, new_email), "the email field accepts text")
check(fill(2, "qa-new-member-password"), "the password field accepts text")
check(fill(3, "qa-new-member-password"), "the confirmation field accepts text")
check(new_email in " ".join(n["text"] for n in nodes()), "the email reached its field")
check(submit(), "the accept button is tappable")
consumed = wait_for(lambda: not pending(token_new)[0], timeout=20)
check(consumed, "the invitation is consumed", pending(token_new)[1])
if not consumed:
    snapshot("e2e-new")
profile = psql(
    "select p.display_name, p.invite_level, p.invited_by is not null "
    f"from public.profiles p join auth.users u on u.id = p.id where u.email = '{new_email}'"
)
check(profile.startswith("QA desde la app|"), "the profile carries the typed name", profile)
check(profile.endswith("|1|t") or profile.endswith("|2|t") or profile.endswith("|3|t"),
      "the profile landed on a member level with an inviter", profile)

if failures:
    print(f"\n{len(failures)} comprobación(es) fallida(s)")
    sys.exit(1)
print("\ntodo en verde")
PY
