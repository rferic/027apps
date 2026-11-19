import { joinCodePreviewRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * GET /api/v1/join-codes/{code}/preview — public preview of a join code.
 * `code` is the `027_join_` token, not a UUID.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return joinCodePreviewRoute(await invitationsRouteDeps())(req, code);
}
