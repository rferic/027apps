import { withDoor } from "@027apps/core/api/door.js";
import { importIdentities } from "@027apps/owe-no/domain/importer.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/imports/identities — active accounts to map (creator). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 30 },
    },
    door,
    async (ctx) => {
      try {
        return json({ identities: await importIdentities(owe, callerId(ctx.caller), id) });
      } catch (error) {
        domainError(error);
      }
    },
  );
}
