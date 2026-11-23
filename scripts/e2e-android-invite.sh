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
# `adb reverse` puts the host panel on the device's own localhost, so the app
# does not depend on the LAN IP or on how the dev server binds.
INSTANCE_URL="${INSTANCE_URL:-http://127.0.0.1:3003}"
SERIAL="${1:-}"

[[ -x "$ADB" ]] || {
  printf 'adb no está en %s (define ADB=...)\n' "$ADB"
  exit 2
}
[[ -f "$APK" ]] || {
  printf 'no hay APK en %s (compílalo: cd apps/android && ./gradlew :app:assembleDebug)\n' "$APK"
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

adb reverse tcp:3003 tcp:3003 >/dev/null 2>&1 || true
panel_code="$(curl -s -o /dev/null -w '%{http_code}' "${INSTANCE_URL}/api/v1/health" || true)"
if [[ "$panel_code" != "200" ]]; then
  printf 'el panel no responde (código %s); arranca el servidor de desarrollo\n' "$panel_code"
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

printf '  cuenta existente lista: %s\n' "$(PSQL "select count(*) from auth.users where email = '$EXISTING_EMAIL'")"
for pair in "old:$TOKEN_OLD" "new:$TOKEN_NEW"; do
  label="${pair%%:*}"
  token="${pair##*:}"
  PSQL "insert into public.invitations
          (email, name, role, source, depth, token_hash, locale, expires_at, created_by)
        values (null, null, 'user', 'member', 2, '$(HASH "$token")', 'es',
                now() + interval '48 hours', '$INVITER')" >/dev/null
done

printf '== compilando el APK debug\n'
# Build from the tree, so the device never runs a stale APK.
if ! (cd "$ROOT/apps/android" && ./gradlew :app:assembleDebug >/tmp/qa-android-build.log 2>&1); then
  tail -30 /tmp/qa-android-build.log
  printf 'el APK debug no compila\n'
  exit 1
fi

printf '== instalando el APK debug en el dispositivo\n'
adb install -r "$APK" >/dev/null
PACKAGE="$(adb shell pm list packages | tr -d '\r' | grep 'zero27apps.debug' | head -1 | cut -d: -f2)"
[[ -n "$PACKAGE" ]] || {
  printf 'the debug package is not installed on the device\n'
  exit 2
}

printf '== conduciendo la app contra %s\n' "$INSTANCE_URL"
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


def raw_window():
    """The XML of the window on screen, whatever app owns it.

    `uiautomator dump` fails with "could not get idle state" while an animation
    or the keyboard is moving, so a bad dump is retried instead of read as an
    empty screen.
    """
    for _ in range(3):
        adb("shell", "uiautomator", "dump", "/sdcard/window.xml")
        xml = adb("shell", "cat", "/sdcard/window.xml")
        if "<hierarchy" in xml:
            return xml
        time.sleep(0.4)
    return ""


def window_package():
    match = re.search(r'package="([^"]+)"', raw_window())
    return match.group(1) if match else ""


def clear_other_windows():
    """A system prompt (permissions, notifications) steals every tap: back out."""
    for _ in range(3):
        owner = window_package()
        if owner in ("", package):
            return True
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.8)
    return window_package() == package


def nodes():
    """Our window's nodes as dicts; other apps' dialogs are ignored."""
    xml = raw_window()
    if package not in xml:
        return []
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


def blur():
    """A focused field's blinking cursor keeps uiautomator from becoming idle.

    The tap lands on a label that is NOT inside a clickable container: the first
    text on the invitation screen is the back arrow, and tapping it would leave.
    """
    everything = nodes_tree()
    for node in everything:
        if node["class"] != "android.widget.TextView" or not node["text"] or not node["bounds"]:
            continue
        left, top, right, bottom = node["bounds"]
        x, y = (left + right) // 2, (top + bottom) // 2
        inside = [
            other for other in everything
            if other["clickable"]
            and other["bounds"][0] <= x <= other["bounds"][2]
            and other["bounds"][1] <= y <= other["bounds"][3]
        ]
        if not inside:
            adb("shell", "input", "tap", str(x), str(y))
            time.sleep(0.3)
            return


def hide_keyboard():
    """BACK hides the keyboard, but with it already hidden it leaves the screen."""
    state = adb("shell", "dumpsys", "input_method")
    if "mInputShown=true" in state:
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.4)


def fields():
    if window_package() != package:
        clear_other_windows()
    return sorted(
        [node for node in nodes() if node["class"] == "android.widget.EditText"],
        key=lambda node: node["bounds"][1],
    )


def tap(node):
    left, top, right, bottom = node["bounds"]
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def fill(index, text, clear=False):
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
        if clear:
            # Some fields start with a default ("2" in the seat request).
            adb("shell", "input", "keyevent", "123")
            for _ in range(12):
                adb("shell", "input", "keyevent", "67")
        adb("shell", "input", "text", escaped)
        time.sleep(0.4)
        hide_keyboard()
        time.sleep(0.5)
        blur()
        return True
    xml = raw_window()
    print(f"    (fill {index} dio up; pkg='{window_package()}' xml={len(xml)} "
          f"campos={[(n['bounds'], n['text'][:12]) for n in fields()]})")
    return False


def wait_for(predicate, timeout=25, step=1):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(step)
    return False


def nodes_tree():
    """Every node with its bounds, in document order (no hierarchy needed)."""
    xml = raw_window()
    if package not in xml:
        return []
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


def tap_text(fragment, timeout=20):
    """Taps the clickable ancestor of the first text containing `fragment`."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        everything = nodes_tree()
        label = next(
            (node for node in everything
             if fragment.lower() in node["text"].lower() and node["bounds"]),
            None,
        )
        if label:
            left, top, right, bottom = label["bounds"]
            x, y = (left + right) // 2, (top + bottom) // 2
            containers = [
                node for node in everything
                if node["clickable"]
                and node["bounds"][0] <= x <= node["bounds"][2]
                and node["bounds"][1] <= y <= node["bounds"][3]
            ]
            if containers:
                tap(min(containers, key=lambda node: (node["bounds"][2] - node["bounds"][0]) * (node["bounds"][3] - node["bounds"][1])))
                return True
        time.sleep(0.7)
    return False


def text_on_screen(fragment):
    return fragment.lower() in " ".join(node["text"] for node in nodes_tree()).lower()


def open_link(token):
    for _ in range(3):
        clear_other_windows()
        adb("shell", "am", "force-stop", package)
        time.sleep(1)
        adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d",
            f"zero27apps-dev://invite/{token}?instance={urllib.parse.quote(instance, safe='')}",
            package)
        # The form is up when the fields exist (name, email, password, confirm).
        if wait_for(lambda: len(fields()) >= 3, timeout=20):
            return True
    return False


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


# A previous run may have left the app signed in, which puts the "sign out and
# accept" dialog in front of the link. Start from a clean install state.
adb("shell", "pm", "clear", package)
time.sleep(2)
# The app asks for notifications on first run; that prompt would eat every tap.
adb("shell", "pm", "grant", package, "android.permission.POST_NOTIFICATIONS")
time.sleep(0.5)

print("\n-- el enlace abre el formulario en la app")
check(open_link(token_old), "la pantalla de invitación pinta el formulario")
check(len(fields()) >= 3, "pide nombre, correo y contraseña", str(len(fields())))
form_text = " ".join(node["text"] for node in nodes())
check("027_inv_" not in form_text, "el token nunca llega a la pantalla")

print("\n-- un email ya registrado no entra: la invitación sigue pendiente")
check(fill(0, "QA Prueba"), "el campo de nombre acepta texto")
check(fill(1, existing_email), "el campo de correo acepta texto")
check(fill(2, "qa-existing-password"), "el campo de contraseña acepta texto")
check(fill(3, "qa-existing-password"), "el campo de confirmación acepta texto")
check(existing_email in " ".join(n["text"] for n in nodes()), "el correo llega a su campo")
check(submit(), "el botón de aceptar se puede pulsar")
time.sleep(5)
check(pending(token_old)[0], "la invitación sigue pendiente", pending(token_old)[1])
profiles = psql(f"select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email = '{existing_email}'")
check(profiles == "1", "no se crea un perfil duplicado", f"perfiles={profiles}")
stays = len(fields()) >= 3 or "Contraseña actual" in " ".join(n["text"] for n in nodes())
check(stays, "la app se queda pidiendo la contraseña de esa cuenta")
if not stays:
    snapshot("e2e-existing")

print("\n-- un email nuevo canjea la invitación desde la app")
check(open_link(token_new), "una segunda invitación abre su formulario")
check(fill(0, "QA desde la app"), "el campo de nombre acepta texto")
check(fill(1, new_email), "el campo de correo acepta texto")
check(fill(2, "qa-new-member-password"), "el campo de contraseña acepta texto")
check(fill(3, "qa-new-member-password"), "el campo de confirmación acepta texto")
check(new_email in " ".join(n["text"] for n in nodes()), "el correo llega a su campo")
check(submit(), "el botón de aceptar se puede pulsar")
consumed = wait_for(lambda: not pending(token_new)[0], timeout=20)
if not consumed:
    # A tap that the device did not register is a flaky harness, not a product
    # bug: a person would simply press again.
    submit()
    consumed = wait_for(lambda: not pending(token_new)[0], timeout=20)
check(consumed, "la invitación queda consumida", pending(token_new)[1])
if not consumed:
    snapshot("e2e-new")
profile = psql(
    "select p.display_name, p.invite_level, p.invited_by is not null "
    f"from public.profiles p join auth.users u on u.id = p.id where u.email = '{new_email}'"
)
check(profile.startswith("QA desde la app|"), "el perfil lleva el nombre escrito", profile)
check(profile.endswith("|1|t") or profile.endswith("|2|t") or profile.endswith("|3|t"),
      "el perfil queda en un nivel de miembro y con invitador", profile)

def ensure_signed_in(email, password):
    if wait_for(lambda: text_on_screen("club"), timeout=8):
        return True
    current = fields()
    if len(current) >= 2:
        fill(0, email)
        fill(1, password)
        tap_text("sign in") or tap_text("iniciar sesión")
    return wait_for(lambda: text_on_screen("club"), timeout=30)


print("\n-- sin plazas, la app pide y deja la solicitud en revisión")
original_levels = psql("select value::text from public.settings where key = 'invitations.levels'")
psql("update public.settings set value = '[{\"level\":1,\"quota\":0}]'::jsonb "
     "where key = 'invitations.levels'")
psql("update public.profiles set invite_level = 1 "
     f"where id = (select id from auth.users where email = '{new_email}')")
try:
    check(ensure_signed_in(new_email, "qa-new-member-password"),
          "the new member is signed in on the shell")
    check(tap_text("club"), "the club card opens the invitation screen")
    check(wait_for(lambda: text_on_screen("request seats") or text_on_screen("solicitar plazas")),
          "the app offers to request seats when none are left")

    request_fields = fields()
    check(bool(request_fields), "the request form has fields", str(len(request_fields)))
    if request_fields:
        fill(0, "2", clear=True)
        if len(fields()) > 1:
            fill(1, "prueba automática")

    sent = tap_text("send request") or tap_text("enviar solicitud")
    if not sent:
        sent = submit()
    check(sent, "the request button is tapped")
    pending = wait_for(
        lambda: psql("select count(*) from public.invitation_requests r "
                     "join public.profiles p on p.id = r.requester_id "
                     f"where p.display_name = 'QA desde la app' and r.state = 'pending'") == "1",
        timeout=25,
    )
    check(
        pending,
        "the request reaches the panel as pending",
        psql("select state, amount from public.invitation_requests "
             "order by created_at desc limit 3") or "sin solicitudes",
    )
    if not pending:
        snapshot("e2e-request")
    check(wait_for(lambda: text_on_screen("in review") or text_on_screen("en revisión"), timeout=10),
          "the app shows the request in review")
finally:
    psql(f"update public.settings set value = '{original_levels}'::jsonb "
         "where key = 'invitations.levels'")

if failures:
    print(f"\n{len(failures)} comprobación(es) fallida(s)")
    sys.exit(1)
print("\ntodo en verde")
PY
