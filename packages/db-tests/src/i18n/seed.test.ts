import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { query, withClient } from "../pg.js";
import { seedTranslations, sha256, type TranslationSeed } from "@027apps/core/i18n/seed.js";

const deps = (c: ClientBase) => ({
  db: {
    query: (sql: string, params: unknown[] = []) => query(c, sql, params),
  },
});

const seed = (
  textEn: string,
  translated: string,
  source: TranslationSeed["source"] = "code",
): TranslationSeed => ({ locale: "es", textEn, translated, source });

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

async function translated(c: ClientBase, locale: string, textEn: string): Promise<string | null> {
  const { rows } = await query(
    c,
    "select translated_text from public.translations where locale = $1 and text_hash = $2",
    [locale, sha256(textEn)],
  );
  return rows[0] ? String(rows[0].translated_text) : null;
}

describe("seedTranslations — idempotency and priority", () => {
  it("running twice does not duplicate rows", async () => {
    await inRollback(async (c) => {
      await seedTranslations(deps(c), [seed("Email", "Correo")]);
      await seedTranslations(deps(c), [seed("Email", "Correo")]);

      const { rows } = await query(
        c,
        "select count(*)::int as n from public.translations where locale = 'es' and text_hash = $1",
        [sha256("Email")],
      );
      expect(rows[0]?.n).toBe(1);
    });
  });

  it("never overwrites a manual translation", async () => {
    await inRollback(async (c) => {
      await query(
        c,
        "insert into public.translations (locale, text_hash, text_en, translated_text, source) values ('es', $1, 'Email', 'Correo manual', 'manual')",
        [sha256("Email")],
      );

      await seedTranslations(deps(c), [seed("Email", "Correo code")]);

      expect(await translated(c, "es", "Email")).toBe("Correo manual");
    });
  });

  it("code overwrites module, but module never overwrites code", async () => {
    await inRollback(async (c) => {
      await seedTranslations(deps(c), [seed("Email", "Módulo", "module")]);
      expect(await translated(c, "es", "Email")).toBe("Módulo");

      await seedTranslations(deps(c), [seed("Email", "Core")]);
      expect(await translated(c, "es", "Email")).toBe("Core");

      await seedTranslations(deps(c), [seed("Email", "Módulo 2", "module")]);
      expect(await translated(c, "es", "Email")).toBe("Core");
    });
  });

  it("deletes removed code rows but keeps manual/import rows", async () => {
    await inRollback(async (c) => {
      await seedTranslations(deps(c), [seed("Email", "Correo"), seed("Password", "Contraseña")]);
      await query(
        c,
        "update public.translations set source = 'manual' where locale = 'es' and text_hash = $1",
        [sha256("Password")],
      );

      // The catalog no longer contains "Email": only "Password" is seeded.
      await seedTranslations(deps(c), [seed("Password", "Contraseña")]);

      expect(await translated(c, "es", "Email")).toBeNull();
      expect(await translated(c, "es", "Password")).toBe("Contraseña");
    });
  });
});
