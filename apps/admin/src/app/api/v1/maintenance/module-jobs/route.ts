import { timingSafeEqual } from "node:crypto";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { runDueModuleJobs } from "@027apps/core/modules/jobs.js";

/** Constant-time comparison that never throws on length mismatch. */
function sameToken(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vercel Cron entry point for module jobs. It does not go through the door on
 * purpose: the caller is a platform cron, not a user or an API key, and the only
 * credential is `MAINTENANCE_CRON_SECRET` (Vercel sends it as a Bearer when the
 * env var exists). No secret is echoed and no stack is returned.
 */
export async function GET(req: Request) {
  const secret = process.env.MAINTENANCE_CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!sameToken(token, secret)) return new Response(null, { status: 401 });

  const { settingsDeps } = await getInfra();
  const result = await runDueModuleJobs(
    { db: settingsDeps.db, withTransaction: withTransactionClient },
    new Date(),
  );
  return Response.json({ executed: result.executed, failed: result.failed });
}
