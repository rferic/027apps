import {
  deactivateUserRoute,
  updateUserRoute,
  userRoute,
} from "@027apps/core/users/api.js";
import { getInfra } from "@/lib/api/door";

/** GET/PATCH/DELETE /api/v1/users/{id} — detail, profile/role edits, soft delete. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return userRoute({ door: deps, auth, users: { db: settingsDeps.db } })(req, id);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return updateUserRoute({ door: deps, auth, users: { db: settingsDeps.db } })(req, id);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return deactivateUserRoute({ door: deps, auth, users: { db: settingsDeps.db } })(req, id);
}
