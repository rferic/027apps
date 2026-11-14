import { withDoor } from "@027apps/core/api/door.js";
import { importCommitSchema } from "@027apps/owe-no/domain/requests.js";
import { commitImport, listImports } from "@027apps/owe-no/domain/importer.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/imports — batches of this group. */
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
      const all = await listImports(owe);
      void callerId(ctx.caller);
      return json({ imports: all.filter((batch) => batch.group_id === id) });
    },
  );
}

/** POST /api/v1/owe-no/groups/{id}/imports — commit the file in one transaction. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: importCommitSchema,
      rateLimit: { identity: "user", limit: 10 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as {
          csv: string;
          mapping?: Record<string, string>;
          confirm_duplicates?: boolean;
        };
        const result = await commitImport(owe, callerId(ctx.caller), id, body.csv, {
          ...(body.mapping ? { mapping: body.mapping } : {}),
          ...(body.confirm_duplicates === undefined
            ? {}
            : { confirmDuplicates: body.confirm_duplicates }),
        });
        return { status: 201, body: json(result) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
