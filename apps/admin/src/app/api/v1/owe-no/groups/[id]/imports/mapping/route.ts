import { withDoor } from "@027apps/core/api/door.js";
import { importMappingOptions } from "@027apps/owe-no/domain/importer.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/imports/mapping — members and accounts (creator). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        return json({
          options: await importMappingOptions(owe, callerId(ctx.caller), id),
        });
      } catch (error) {
        domainError(error);
      }
    },
  );
}
