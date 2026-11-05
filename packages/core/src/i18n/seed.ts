import { createHash } from "node:crypto";
import type { QueryClient } from "../api/rate-limit-storage.js";

/**
 * Seeding is a mirror of the repo catalog (the database is never the source of
 * truth). Priority on collision: manual > import > code > module. Seeding only
 * writes `code` or `module` rows, so `manual`/`import` edits are never lost.
 */
export interface TranslationSeed {
  locale: string;
  textEn: string;
  translated: string;
  source: "code" | "module";
}

export interface I18nSeedDeps {
  db: QueryClient;
}

/** SHA-256 (hex) of the English text; the table key is `(locale, text_hash)`. */
export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const UPSERT = `
  insert into public.translations (locale, text_hash, text_en, translated_text, source)
  values ($1, $2, $3, $4, $5)
  on conflict (locale, text_hash) do update set
    translated_text = excluded.translated_text,
    source = excluded.source,
    updated_at = now()
  where public.translations.source in ('code', 'module')
    and (
      (excluded.source = 'code' and public.translations.source in ('code', 'module'))
      or (excluded.source = 'module' and public.translations.source = 'module')
    )
`;

/** Removed catalog strings: `code` rows disappear, `manual`/`import` survive. */
async function deleteRemovedCodeRows(
  db: QueryClient,
  seeds: readonly TranslationSeed[],
): Promise<void> {
  const hashesByLocale = new Map<string, string[]>();
  for (const seed of seeds) {
    if (seed.source !== "code") continue;
    const hashes = hashesByLocale.get(seed.locale) ?? [];
    hashes.push(sha256(seed.textEn));
    hashesByLocale.set(seed.locale, hashes);
  }
  for (const [locale, hashes] of hashesByLocale) {
    await db.query(
      "delete from public.translations where locale = $1 and source = 'code' and text_hash <> all($2::text[])",
      [locale, hashes],
    );
  }
}

/** Idempotent seeding of the catalog for every locale. */
export async function seedTranslations(
  deps: I18nSeedDeps,
  seeds: readonly TranslationSeed[],
): Promise<void> {
  for (const seed of seeds) {
    await deps.db.query(UPSERT, [
      seed.locale,
      sha256(seed.textEn),
      seed.textEn,
      seed.translated,
      seed.source,
    ]);
  }
  await deleteRemovedCodeRows(deps.db, seeds);
}

/** A seed is valid when the locale, texts and length limits hold. */
export function validateSeed(seed: TranslationSeed): boolean {
  const locales = ["en", "es", "ca", "it", "fr", "de", "pt", "gl", "eu"];
  return (
    locales.includes(seed.locale) &&
    seed.textEn.length > 0 &&
    seed.translated.length > 0 &&
    seed.translated.length <= 2000
  );
}
