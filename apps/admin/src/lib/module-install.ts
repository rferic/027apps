import { redirect } from "next/navigation";
import { installModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INTERNAL_ORIGIN = "http://panel.internal";

/** Why the panel could not install a package; the UI maps each to a message. */
export type InstallFailureReason =
  | "already_installed"
  | "invalid_manifest"
  | "forbidden"
  | "failed";

export type InstallResult =
  | { ok: true }
  | { ok: false; reason: InstallFailureReason; requestId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** The Core owns the rejection; the status is the contract the panel maps. */
function failureReason(status: number): InstallFailureReason {
  switch (status) {
    case 409:
      return "already_installed";
    case 400:
      return "invalid_manifest";
    case 403:
      return "forbidden";
    default:
      return "failed";
  }
}

/**
 * `request_id` from the envelope or the header, whichever the route filled.
 * A body that is not JSON, or lacks the envelope, never hides the header.
 */
async function readRequestId(res: Response): Promise<string | undefined> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    const body: unknown = JSON.parse(await res.text());
    if (!isRecord(body) || !isRecord(body.error)) return headerRequestId;
    return readString(body.error.request_id) ?? headerRequestId;
  } catch {
    return headerRequestId;
  }
}

/**
 * POST /api/v1/modules/{key}/install, in process: a fixed internal origin
 * (never the client's `host`), the session as Bearer, and only `key` from the
 * caller. The Core re-reads and validates the trusted package, so the panel
 * cannot install anything the server does not already have.
 */
export async function installModule(key: string): Promise<InstallResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");

  let res: Response;
  try {
    res = await installModuleRoute(await modulesRouteDeps())(
      new Request(`${INTERNAL_ORIGIN}/api/v1/modules/${encodeURIComponent(key)}/install`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      key,
    );
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (res.ok) return { ok: true };

  const requestId = await readRequestId(res);
  return {
    ok: false,
    reason: failureReason(res.status),
    ...(requestId ? { requestId } : {}),
  };
}
