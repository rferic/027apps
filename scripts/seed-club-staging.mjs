#!/usr/bin/env node
/**
 * Seeds the club demo in a remote instance (staging) through its real APIs.
 *
 * It creates `club.qa.*@example.com` accounts, their profiles (role, level,
 * locale), invitations in every state, one grant and one pending seat request,
 * so the owner can review the club with data. Nothing is written directly to
 * Postgres: accounts go through Supabase Auth, the profiles through PostgREST
 * with the service role, and the club state through the panel API.
 *
 * Usage (staging):
 *   VERCEL_PROTECTION_BYPASS=... BASE_URL=https://<alias> \
 *   node scripts/seed-club-staging.mjs
 *
 * Reads SUPABASE env from the process or from `/tmp/club-seed.env`. Refuses to
 * run twice: if the admin account already exists it stops without touching
 * anything.
 */

import { readFileSync } from "node:fs";

// The redeem endpoint requires 12+ characters: keep the demo password valid.
const PASSWORD = process.env.CLUB_QA_PASSWORD ?? "ClubQA2026-demo";

function loadEnv() {
  try {
    for (const line of readFileSync("/tmp/club-seed.env", "utf8").split("\n")) {
      const index = line.indexOf("=");
      if (index > 0 && !process.env[line.slice(0, index)]) {
        process.env[line.slice(0, index)] = line.slice(index + 1);
      }
    }
  } catch {
    // The variables are already in the environment.
  }
}

loadEnv();

const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS ?? "";
const TEAM = process.env.VERCEL_TEAM_ID ?? "";

const missing = [
  ["BASE_URL", BASE],
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
].filter(([, value]) => !value).map(([key]) => key);
if (missing.length > 0) {
  console.error("faltan:", missing.join(", "), "(entorno o /tmp/club-seed.env)");
  process.exit(2);
}

const ACCOUNTS = {
  admin: { email: "club.qa.admin@example.com", name: "QA Admin Club", role: "super_admin", level: null },
  level1: { email: "club.qa.nivel1@example.com", name: "QA Nivel 1", role: "user", level: 1 },
  level3: { email: "club.qa.nivel3@example.com", name: "QA Nivel 3", role: "user", level: 3 },
  noSeats: { email: "club.qa.sinplazas@example.com", name: "QA Sin Plazas", role: "user", level: 4 },
  invitee1: { email: "club.qa.invitado1@example.com", name: "QA Invitado Uno" },
  invitee2: { email: "club.qa.invitado2@example.com", name: "QA Invitado Dos" },
};

/** Panel requests carry the Vercel bypass when the instance is protected. */
function panelHeaders(token) {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(BYPASS ? { "x-vercel-protection-bypass": BYPASS } : {}),
  };
}

async function api(method, path, body, token) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: panelHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 120) };
  }
  return { status: response.status, body: parsed };
}

async function supabaseAdmin(method, path, body) {
  const response = await fetch(`${SUPABASE}${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function findUser(email) {
  const { body } = await supabaseAdmin("GET", `/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
  return (body?.users ?? []).find((user) => user.email === email) ?? null;
}

async function createUser(email) {
  const existing = await findUser(email);
  if (existing) return existing.id;
  const { status, body } = await supabaseAdmin("POST", "/auth/v1/admin/users", {
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (status >= 400 || !body?.id) throw new Error(`no se pudo crear ${email}: ${JSON.stringify(body).slice(0, 160)}`);
  return body.id;
}

async function setProfile(id, { name, role = "user", level = null }) {
  const response = await fetch(`${SUPABASE}/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ id, display_name: name, role, invite_level: level, locale: "es" }]),
  });
  if (!response.ok) throw new Error(`perfil ${name}: ${response.status} ${(await response.text()).slice(0, 160)}`);
}

async function signIn(email) {
  const response = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await response.json();
  if (!body.access_token) throw new Error(`no pude entrar como ${email}`);
  return body.access_token;
}

async function mint(token) {
  const { status, body } = await api("POST", "/api/v1/me/invitations", {}, token);
  if (status !== 201) throw new Error(`crear enlace: ${status} ${JSON.stringify(body).slice(0, 160)}`);
  return body;
}

async function redeem(token, email, name) {
  const { status, body } = await api("POST", `/api/v1/invitations/${token}/redeem`, {
    email,
    name,
    password: PASSWORD,
  });
  if (status !== 201) throw new Error(`canje ${email}: ${status} ${JSON.stringify(body).slice(0, 160)}`);
  return body;
}

const summary = [];

try {
  const health = await api("GET", "/api/v1/health");
  if (health.status !== 200) throw new Error(`la instancia no responde (${health.status})`);

  if (await findUser(ACCOUNTS.admin.email)) {
    console.log("ya sembrado: existe", ACCOUNTS.admin.email, "— no se toca nada");
    process.exit(0);
  }

  for (const [key, account] of Object.entries(ACCOUNTS)) {
    if (key === "admin" || key === "level1" || key === "level3" || key === "noSeats") {
      const id = await createUser(account.email);
      await setProfile(id, account);
    }
  }

  const adminToken = await signIn(ACCOUNTS.admin.email);
  const level1Token = await signIn(ACCOUNTS.level1.email);
  const level3Token = await signIn(ACCOUNTS.level3.email);
  const noSeatsToken = await signIn(ACCOUNTS.noSeats.email);

  // A grant on level 1: the quota line reads "base + granted".
  const level1Id = (await findUser(ACCOUNTS.level1.email)).id;
  const grant = await api("POST", `/api/v1/users/${level1Id}/invitation-grants`, { amount: 2, reason: "Prueba de QA" }, adminToken);
  if (grant.status >= 400) throw new Error(`concesión: ${grant.status} ${JSON.stringify(grant.body).slice(0, 160)}`);

  // One redeemed invitee (level 2) and one pending link for the same member.
  const first = await mint(level1Token);
  await redeem(first.token, ACCOUNTS.invitee1.email, ACCOUNTS.invitee1.name);
  await mint(level1Token);

  // Level 3 has one seat: its invitee leaves it at zero without a request.
  const third = await mint(level3Token);
  await redeem(third.token, ACCOUNTS.invitee2.email, ACCOUNTS.invitee2.name);

  // No seats at all: a pending request so the panel inbox has something to approve.
  const request = await api("POST", "/api/v1/me/invitation-requests", { amount: 2, reason: "Sin plazas para la familia" }, noSeatsToken);
  if (request.status !== 201) throw new Error(`solicitud: ${request.status} ${JSON.stringify(request.body).slice(0, 160)}`);

  // A named invitation from the panel, so the admin list shows every source.
  const named = await api("POST", "/api/v1/invitations", {
    email: "club.qa.nominada@example.com",
    name: "QA Nominada",
    expires_in_days: 7,
  }, adminToken);
  if (named.status >= 400) throw new Error(`invitación con nombre: ${named.status}`);

  summary.push({ cuenta: ACCOUNTS.admin.email, rol: "super_admin", nivel: "—", para: "panel y aprobaciones" });
  summary.push({ cuenta: ACCOUNTS.level1.email, rol: "user", nivel: "1 (+2 concedidas)", para: "1 invitado, 1 enlace pendiente" });
  summary.push({ cuenta: ACCOUNTS.level3.email, rol: "user", nivel: "3", para: "sin plazas, sin solicitud" });
  summary.push({ cuenta: ACCOUNTS.noSeats.email, rol: "user", nivel: "4 (sin cuota)", para: "solicitud pendiente de 2" });
  summary.push({ cuenta: ACCOUNTS.invitee1.email, rol: "user", nivel: "2", para: "invitado de nivel 1" });
  summary.push({ cuenta: ACCOUNTS.invitee2.email, rol: "user", nivel: "4", para: "invitado de nivel 3" });

  console.log("sembrado en", BASE);
  console.table(summary);
  console.log("contraseña de todas las cuentas:", PASSWORD);
} catch (error) {
  console.error("fallo al sembrar:", error.message);
  process.exitCode = 1;
}
