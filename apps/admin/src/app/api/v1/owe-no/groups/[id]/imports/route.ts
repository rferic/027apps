import { withDoor } from "@027apps/core/api/door.js";
import { importCommitSchema } from "@027apps/owe-no/domain/requests.js";
import { commitImport, importsForGroup } from "@027apps/owe-no/domain/importer.js";
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
      try {
        return json({ imports: await importsForGroup(owe, callerId(ctx.caller), id) });
      } catch (error) {
        domainError(error);
      }
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
          new_members?: Array<{ name: string; display_name?: string; user_id?: string }>;
          confirm_duplicates?: boolean;
          reset?: boolean;
        };
        const result = await commitImport(owe, callerId(ctx.caller), id, body.csv, {
          ...(body.mapping ? { mapping: body.mapping } : {}),
          ...(body.new_members
            ? {
                newMembers: body.new_members.map((member) => ({
                  name: member.name,
                  ...(member.display_name ? { displayName: member.display_name } : {}),
                  ...(member.user_id ? { userId: member.user_id } : {}),
                })),
              }
            : {}),
          ...(body.confirm_duplicates === undefined
            ? {}
            : { confirmDuplicates: body.confirm_duplicates }),
          ...(body.reset === true ? { reset: true } : {}),
        });
        return { status: 201, body: json(result) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
