import { withDoor } from "../api/door";
import { DomainError } from "../errors";
import type { Caller, CorsOptions, DoorDeps } from "../api/types";
import type { SettingsDeps } from "../settings/service";
import { SUPPORTED_LOCALES } from "../settings/catalog";
import { computeEtag } from "./etag";

/**
 * GET /api/v1/translations?locale=xx — authenticated map `text_en → texto`
 * for an enabled locale (fallback to English is implicit in the client `t()`).
 * The ETag is the hash of the served body, so a `manual`/`import` edit changes
 * it on the next request and `If-None-Match` answers 304.
 */
/** Authenticated per-user payload: revalidate with the ETag. */
const CACHE_CONTROL = "private, max-age=0, must-revalidate";

export interface TranslationsRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  settings: SettingsDeps;
  cors?: CorsOptions;
  rateLimits?: { read?: number };
}

async function enabledLocales(settings: SettingsDeps): Promise<string[]> {
  const { rows } = await settings.db.query(
    "select value from public.settings where key = 'localization.enabled_locales'",
  );
  const value = rows[0]?.value;
  return Array.isArray(value) ? (value as string[]) : ["en"];
}

export function translationsRoute(deps: TranslationsRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ["profile:read"],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: "user", limit: deps.rateLimits?.read ?? 120 },
      },
      deps.door,
      async (ctx) => {
        const locale = ctx.searchParams.get("locale");
        if (!locale) throw new DomainError("validation_failed", "locale is required");
        if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
          throw new DomainError("locale_not_available");
        }
        if (!(await enabledLocales(deps.settings)).includes(locale)) {
          throw new DomainError("locale_not_available");
        }

        const { rows } = await deps.settings.db.query(
          "select text_en, translated_text from public.translations where locale = $1 order by text_en",
          [locale],
        );
        const translations: Record<string, string> = {};
        for (const row of rows) {
          translations[String(row.text_en)] = String(row.translated_text);
        }

        const body = { locale, translations };
        const etag = computeEtag(body);
        if (req.headers.get("if-none-match") === etag) {
          return new Response(null, {
            status: 304,
            headers: { ETag: etag, "cache-control": CACHE_CONTROL },
          });
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            "content-type": "application/json",
            ETag: etag,
            "cache-control": CACHE_CONTROL,
          },
        });
      },
    );
}
