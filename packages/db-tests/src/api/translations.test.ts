import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { query, withClient } from "../pg.js";
import { sha256 } from "@027apps/core/i18n/seed.js";
import { translationsRoute } from "@027apps/core/i18n/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";
import type { SettingsDeps } from "@027apps/core/settings/service.js";

const door: DoorDeps = {
  rateLimitStorage: { increment: async () => ({ count: 1 }) },
  logger: () => {},
};

const settingsDeps = (c: ClientBase): SettingsDeps => ({
  db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
  encryption: null,
  currencies: { isEnabled: async () => true },
});

function route(c: ClientBase, caller: Caller = { kind: "session", userId: "u1", role: "super_admin" }) {
  return translationsRoute({
    door,
    auth: async () => caller,
    settings: settingsDeps(c),
  });
}

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

async function enableSpanish(c: ClientBase): Promise<void> {
  await query(
    c,
    "update public.settings set value = $1 where key = 'localization.enabled_locales'",
    [JSON.stringify(["en", "es"])],
  );
}

async function insertSpanish(c: ClientBase): Promise<void> {
  await query(
    c,
    "insert into public.translations (locale, text_hash, text_en, translated_text, source) values ('es', $1, 'Email', 'Correo', 'code')",
    [sha256("Email")],
  );
}

describe("GET /api/v1/translations", () => {
  it("returns the resolved map and an ETag for an enabled locale", async () => {
    await inRollback(async (c) => {
      await enableSpanish(c);
      await insertSpanish(c);

      const res = await route(c)(new Request("http://local/api/v1/translations?locale=es"));

      expect(res.status).toBe(200);
      expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{64}"$/);
      const body = (await res.json()) as { locale: string; translations: Record<string, string> };
      expect(body.locale).toBe("es");
      expect(body.translations.Email).toBe("Correo");
    });
  });

  it("answers 304 when If-None-Match matches the served body", async () => {
    await inRollback(async (c) => {
      await enableSpanish(c);
      await insertSpanish(c);

      const first = await route(c)(new Request("http://local/api/v1/translations?locale=es"));
      const etag = first.headers.get("etag")!;
      const second = await route(c)(
        new Request("http://local/api/v1/translations?locale=es", {
          headers: { "if-none-match": etag },
        }),
      );

      expect(second.status).toBe(304);
      expect(second.headers.get("etag")).toBe(etag);
    });
  });

  it("rejects a locale that is not enabled", async () => {
    await inRollback(async (c) => {
      const res = await route(c)(new Request("http://local/api/v1/translations?locale=ca"));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("locale_not_available");
    });
  });

  it("rejects a missing or unsupported locale", async () => {
    await inRollback(async (c) => {
      const missing = await route(c)(new Request("http://local/api/v1/translations"));
      expect(missing.status).toBe(400);

      const unsupported = await route(c)(new Request("http://local/api/v1/translations?locale=xx"));
      expect(unsupported.status).toBe(400);
      const body = (await unsupported.json()) as { error: { code: string } };
      expect(body.error.code).toBe("locale_not_available");
    });
  });

  it("requires a session", async () => {
    await inRollback(async (c) => {
      const res = await route(c, { kind: "anon" })(
        new Request("http://local/api/v1/translations?locale=en"),
      );
      expect(res.status).toBe(401);
    });
  });
});

function routeWithDoor(
  c: ClientBase,
  door: DoorDeps,
  caller: Caller = { kind: "session", userId: "u1", role: "super_admin" },
) {
  return translationsRoute({ door, auth: async () => caller, settings: settingsDeps(c) });
}

describe("GET /api/v1/translations — authorization, limits and ETag", () => {
  it("answers 403 when the caller lacks the scope", async () => {
    await inRollback(async (c) => {
      const res = await route(c, { kind: "service", keyId: "k1", scopes: [], roleCap: "admin" })(
        new Request("http://local/api/v1/translations?locale=en"),
      );
      expect(res.status).toBe(403);
    });
  });

  it("answers 429 when the rate limit is exceeded", async () => {
    await inRollback(async (c) => {
      const limited: DoorDeps = {
        rateLimitStorage: { increment: async () => ({ count: 241 }) },
        logger: () => {},
      };
      const res = await routeWithDoor(c, limited)(
        new Request("http://local/api/v1/translations?locale=en"),
      );
      expect(res.status).toBe(429);
    });
  });

  it("returns an empty map when an enabled locale has no rows", async () => {
    await inRollback(async (c) => {
      await enableSpanish(c);
      // A developer's instance may already hold module copy for `es`.
      await query(c, "delete from public.translations where locale = 'es'");
      const res = await route(c)(new Request("http://local/api/v1/translations?locale=es"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { translations: Record<string, string> };
      expect(body.translations).toEqual({});
    });
  });

  it("changes the ETag after a manual edit of the translation", async () => {
    await inRollback(async (c) => {
      await enableSpanish(c);
      await insertSpanish(c);
      const first = await route(c)(new Request("http://local/api/v1/translations?locale=es"));
      const firstEtag = first.headers.get("etag");

      await query(
        c,
        "update public.translations set translated_text = 'Correo manual', source = 'manual' where locale = 'es' and text_hash = $1",
        [sha256("Email")],
      );

      const second = await route(c)(new Request("http://local/api/v1/translations?locale=es"));
      expect(second.status).toBe(200);
      expect(second.headers.get("etag")).not.toBe(firstEtag);
      const body = (await second.json()) as { translations: Record<string, string> };
      expect(body.translations.Email).toBe("Correo manual");
    });
  });
});
