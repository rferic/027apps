import { withDoor } from "@027apps/core/api/door.js";
import { importPreviewSchema } from "@027apps/owe-no/domain/requests.js";
import { previewImport } from "@027apps/owe-no/domain/importer.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** POST /api/v1/owe-no/groups/{id}/imports/preview — dry run, writes nothing. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: importPreviewSchema,
      rateLimit: { identity: "user", limit: 10 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { csv: string };
        return json(await previewImport(owe, callerId(ctx.caller), id, body.csv));
      } catch (error) {
        domainError(error);
      }
    },
  );
}
