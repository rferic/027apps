import { z } from "zod";
import { withDoor } from "@027apps/core/api/door.js";
import { revokeOtherSessions } from "@027apps/core/auth/other-sessions.js";
import { getInfra } from "@/lib/api/door";

const body = z.object({ keep_session_id: z.uuid() }).strict();

/**
 * POST /api/v1/me/sessions/revoke-others — end every session of the caller
 * except the one asking. The phone-migration flow uses it to expel the old
 * phone server-side instead of trusting the client's `signOut(others)`.
 */
export async function POST(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return withDoor(
    req,
    {
      scopes: ["devices:revoke"],
      auth,
      schema: body,
      rateLimit: { identity: "user", limit: 10, bucket: "sessions-revoke" },
    },
    deps,
    async (ctx) =>
      revokeOtherSessions(
        { db: settingsDeps.db },
        ctx.caller,
        (ctx.body as { keep_session_id: string }).keep_session_id,
      ),
  );
}
