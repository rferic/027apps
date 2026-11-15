import { DomainError } from "../errors";
import type { QueryClient } from "../api/rate-limit-storage";
import type { Caller, JsonValue } from "../api/types";
import { resetSessionSettings } from "./session-settings";
import type { ModulesDeps } from "./service";

type Widget = {
  key: string;
  type: "summary" | "metric" | "list";
  surface: "app" | "panel";
  title: string;
  icon: string;
  order: number;
  data_fn: string;
};

export type DashboardWidget = {
  key: string;
  type: Widget["type"];
  surface: Widget["surface"];
  title: string;
  icon: string;
  order: number;
  module_key: string;
  data: JsonValue | null;
};

const IDENT = /^[a-z][a-z0-9_]{0,62}$/;
const TIMEOUT_MS = 5_000;

function schemaFor(key: string): string {
  return `module_${key.replace(/-/g, "_")}`;
}

function quote(identifier: string): string {
  return `"${identifier}"`;
}

function isAdmin(caller: Caller): boolean {
  if (caller.kind === "session") return caller.role === "admin" || caller.role === "super_admin";
  if (caller.kind === "service") return true;
  return false;
}

/**
 * Widgets of the active modules the caller can use, with the data each module
 * resolves through its `data_fn(user_id)`. Access mirrors `listModules`: admin,
 * public module, or an active grant. A module whose function fails is omitted,
 * never the whole dashboard.
 */
export async function getDashboardWidgets(
  deps: ModulesDeps,
  caller: Caller,
  surface?: "app" | "panel",
): Promise<DashboardWidget[]> {
  if (!deps.withTransaction) throw new DomainError("internal", "widgets need a transaction runner");
  if (caller.kind === "anon") return [];
  const userId =
    caller.kind === "session" || caller.kind === "delegated" ? caller.userId : null;
  if (!isAdmin(caller) && !userId) return [];

  const { rows } = await deps.db.query(
    `select key, dashboard_widgets
       from public.module_registry m
      where m.state = 'active'
        and jsonb_array_length(dashboard_widgets) > 0
        and ($1::boolean
             or m.is_public
             or exists (
               select 1 from public.user_modules u
                where u.user_id = $2 and u.module_key = m.key and u.revoked_at is null
             ))`,
    [isAdmin(caller), userId],
  );

  const widgets: DashboardWidget[] = [];
  for (const row of rows) {
    const moduleKey = String(row.key);
    for (const widget of (row.dashboard_widgets as Widget[] | null) ?? []) {
      if (surface && widget.surface !== surface) continue;
      if (!IDENT.test(widget.data_fn)) continue;
      const data = await resolveData(deps, moduleKey, widget, userId);
      if (data === null) continue;
      widgets.push({
        key: widget.key,
        type: widget.type,
        surface: widget.surface,
        title: widget.title,
        icon: widget.icon,
        order: widget.order,
        module_key: moduleKey,
        data,
      });
    }
  }

  return widgets.sort((left, right) =>
    left.order === right.order ? left.key.localeCompare(right.key) : left.order - right.order,
  );
}

/** `null` means "omit this widget": a broken resolver never breaks the page. */
async function resolveData(
  deps: ModulesDeps,
  moduleKey: string,
  widget: Widget,
  userId: string | null,
): Promise<JsonValue | null> {
  try {
    return await deps.withTransaction!(async (db: QueryClient) => {
      try {
        await db.query(`set local statement_timeout = ${TIMEOUT_MS}`);
        await db.query(`set local search_path to ${quote(schemaFor(moduleKey))}`);
        const { rows } = await db.query(`select ${quote(widget.data_fn)}($1::uuid) as data`, [
          userId,
        ]);
        const value = rows[0]?.data;
        return value === undefined ? null : (value as JsonValue);
      } finally {
        await resetSessionSettings(db);
      }
    });
  } catch {
    return null;
  }
}
