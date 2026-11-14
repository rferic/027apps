import { withDoor } from "@027apps/core/api/door.js";
import { settlementPlan } from "@027apps/owe-no/domain/service.js";
import { json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/settlement — who pays whom, and how few. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["balances:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => {
      const plan = await settlementPlan(owe, callerId(ctx.caller), id);
      return json({
        exact: plan.exact,
        transfers: plan.transfers.map((transfer) => ({
          from: transfer.from,
          to: transfer.to,
          amount_minor: transfer.amount_minor,
        })),
      });
    },
  );
}
