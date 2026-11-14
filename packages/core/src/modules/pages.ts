import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * What a module's admin page receives. The host only renders the page after its
 * own gates (session, role from the manifest and module `active`), so `caller`
 * is always an admin session here. `db` is the platform connection: module pages
 * are first-party code and reuse the same service functions as their API, so
 * the access rules live in one place, not once per page.
 */
export interface ModulePageContext {
  moduleKey: string;
  caller: Caller & { kind: "session" };
  db: QueryClient;
  /** Panel locale of the request (`en`, `es`, …). */
  locale: string;
  /**
   * The module's own `locales/<locale>.json` map (English text → translation),
   * with English as the fallback. Pages translate through `t(text, messages)`
   * so the panel never shows a hardcoded English string.
   */
  messages: Record<string, string>;
}
