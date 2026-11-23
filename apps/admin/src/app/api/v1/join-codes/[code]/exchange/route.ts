import { joinCodeExchangeRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * POST /api/v1/join-codes/{code}/exchange — public single-use exchange that
 * mints a 15-minute invitation. `code` is the `027_join_` token, not a UUID.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return joinCodeExchangeRoute(await invitationsRouteDeps())(req, code);
}
