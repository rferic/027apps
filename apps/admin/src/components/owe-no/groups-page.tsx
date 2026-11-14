import { notFound } from "next/navigation";
import type { Caller } from "@027apps/core/api/types.js";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import GroupsPage from "@027apps/owe-no/admin/groups/page";
import {
  adminGroupDetail,
  adminSettlementPlan,
  adminUserOptions,
} from "@027apps/owe-no/domain/admin.js";
import { listAllGroups } from "@027apps/owe-no/domain/service.js";
import {
  addMemberAction,
  archiveGroupAction,
  createGroupAction,
  deleteMovementAction,
  linkMemberAction,
  removeMemberAction,
  saveMovementAction,
  settleAction,
} from "@/lib/owe-no-actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Wires the module's presentational groups page to the panel's server actions.
 * The package cannot import `@/lib/owe-no-actions` (that is app code), so the
 * wrapper owns the action map and the route-level 404; the page keeps the UI and
 * the context (locale, messages).
 */
export default async function OweNoGroupsPage({ context }: { context: ModulePageContext }) {
  const raw = context.searchParams.group;
  const groupId = typeof raw === "string" && raw !== "" ? raw : undefined;
  if (groupId && !UUID.test(groupId)) notFound();

  const caller = context.caller as Caller & { role: "admin" | "super_admin" };
  const deps = { db: context.db };

  const detail = groupId
    ? await adminGroupDetail(deps, caller, groupId).catch(() => notFound())
    : null;
  const groups = detail ? [] : await listAllGroups(deps);
  const userOptions = await adminUserOptions(deps, caller);
  const plan =
    detail && !detail.group.archived
      ? await adminSettlementPlan(deps, caller, detail.group.id)
      : null;

  return (
    <GroupsPage
      context={context}
      groups={groups}
      detail={detail}
      userOptions={userOptions}
      plan={plan}
      actions={{
        createGroup: createGroupAction,
        archiveGroup: archiveGroupAction,
        addMember: addMemberAction,
        linkMember: linkMemberAction,
        removeMember: removeMemberAction,
        saveMovement: saveMovementAction,
        deleteMovement: deleteMovementAction,
        settle: settleAction,
      }}
    />
  );
}
