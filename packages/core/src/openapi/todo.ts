import { z } from "zod";
import type { OpenApiOperation } from "./registry";
import { component } from "./schemas";

/**
 * NotNow's published contract (spec §6). The bodies mirror
 * `packages/todo/src/domain/schemas.ts` and the views mirror the domain types;
 * the Core cannot import a module package, so the two are kept in step by hand
 * and `check:openapi` fails as soon as a route stops being documented.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoStamp = z.iso.datetime();
const period = z.enum(["infinite", "weekly", "monthly", "yearly"]);
const recurrence = z.enum(["none", "weekly", "monthly", "yearly"]);

export const todoGroupSchema = component(
  "TodoGroup",
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      kind: z.enum(["group", "personal"]),
      ownerId: z.uuid().nullable(),
      timezone: z.string(),
      powerEnabled: z.boolean(),
      powerPeriod: period,
      seasonNumber: z.number().int(),
      seasonStartedOn: isoDate,
      memberCount: z.number().int(),
      pendingCount: z.number().int(),
    })
    .strict(),
);

const todoGroupPlainSchema = component(
  "TodoGroupPlain",
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      kind: z.enum(["group", "personal"]),
      ownerId: z.uuid().nullable(),
      timezone: z.string(),
      powerEnabled: z.boolean(),
      powerPeriod: period,
      seasonNumber: z.number().int(),
      seasonStartedOn: isoDate,
    })
    .strict(),
);

export const todoMemberSchema = component(
  "TodoMember",
  z
    .object({
      userId: z.uuid(),
      displayName: z.string(),
      role: z.enum(["owner", "member"]),
    })
    .strict(),
);

export const todoTaskSchema = component(
  "TodoTask",
  z
    .object({
      id: z.uuid(),
      groupId: z.uuid(),
      title: z.string(),
      notes: z.string().nullable(),
      categoryId: z.uuid().nullable(),
      power: z.number().int().nullable(),
      assigneeId: z.uuid().nullable(),
      assigneeName: z.string(),
      state: z.enum(["pending", "done"]),
      recurrence,
      keepAssignee: z.boolean(),
      dueOn: isoDate.nullable(),
      periodStart: isoDate.nullable(),
      periodEnd: isoDate.nullable(),
      completedAt: isoStamp.nullable(),
      createdAt: isoStamp,
    })
    .strict(),
);

export const todoOccurrenceSchema = component(
  "TodoOccurrence",
  z
    .object({
      id: z.uuid(),
      periodStart: isoDate,
      periodEnd: isoDate,
      outcome: z.enum(["done", "missed"]),
      completedAt: isoStamp.nullable(),
      completedByName: z.string(),
    })
    .strict(),
);

export const todoRequestSchema = component(
  "TodoRequest",
  z
    .object({
      id: z.uuid(),
      groupId: z.uuid(),
      taskId: z.uuid(),
      requesterId: z.uuid().nullable(),
      state: z.enum(["pending", "accepted", "denied", "expired"]),
      createdAt: isoStamp,
      expiresAt: isoStamp,
      resolvedAt: isoStamp.nullable(),
      taskTitle: z.string(),
      groupName: z.string(),
      requesterName: z.string(),
    })
    .strict(),
);

export const todoCategorySchema = component(
  "TodoCategory",
  z
    .object({
      id: z.uuid(),
      name: z.string(),
      emoji: z.string(),
      color: z.enum(["teal", "indigo", "violet", "amber", "rose", "emerald", "sky", "slate"]),
      sortOrder: z.number().int(),
    })
    .strict(),
);

export const todoPowerRowSchema = component(
  "TodoPowerRow",
  z
    .object({
      userId: z.uuid().nullable(),
      displayName: z.string(),
      points: z.number().int(),
      tasksDone: z.number().int(),
      position: z.number().int(),
    })
    .strict(),
);

export const todoBoardSchema = component(
  "TodoBoard",
  z
    .object({
      seasonNumber: z.number().int(),
      period,
      startedOn: isoDate,
      rows: z.array(todoPowerRowSchema),
    })
    .strict(),
);

export const todoSeasonSchema = component(
  "TodoSeason",
  z
    .object({
      number: z.number().int(),
      period,
      startedOn: isoDate,
      closedOn: isoDate.nullable(),
      rows: z.array(todoPowerRowSchema).optional(),
    })
    .strict(),
);

const createGroup = component(
  "TodoCreateGroup",
  z
    .object({
      name: z.string().trim().min(1).max(240),
      timezone: z.string().min(1).max(64).optional(),
      power_enabled: z.boolean().optional(),
      power_period: period.optional(),
    })
    .strict(),
);

const updateGroup = component(
  "TodoUpdateGroup",
  z
    .object({
      name: z.string().trim().min(1).max(240).optional(),
      timezone: z.string().min(1).max(64).optional(),
      power_enabled: z.boolean().optional(),
      power_period: period.optional(),
    })
    .strict(),
);

const addMember = component(
  "TodoAddMember",
  z.object({ user_id: z.uuid() }).strict(),
);

const createTask = component(
  "TodoCreateTask",
  z
    .object({
      title: z.string().trim().min(1).max(240),
      notes: z.string().max(4000).nullish(),
      category_id: z.uuid().nullish(),
      power: z.number().int().min(1).max(5).nullish(),
      assignee_id: z.uuid().nullish(),
      due_on: isoDate.nullish(),
      recurrence: recurrence.optional(),
      keep_assignee: z.boolean().optional(),
    })
    .strict(),
);

const updateTask = component(
  "TodoUpdateTask",
  z
    .object({
      title: z.string().trim().min(1).max(240).optional(),
      notes: z.string().max(4000).nullish(),
      category_id: z.uuid().nullish(),
      power: z.number().int().min(1).max(5).nullish(),
      due_on: isoDate.nullish(),
    })
    .strict(),
);

const taskQuery = z.object({
  state: z.enum(["pending", "done", "all"]).optional(),
  category: z.uuid().optional(),
  assignee: z.literal("me").optional(),
  overdue: z.enum(["1", "true"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
});

const requestQuery = z.object({ direction: z.enum(["incoming", "outgoing"]).default("incoming") });

const groupsResponse = component(
  "TodoGroupsResponse",
  z.object({ groups: z.array(todoGroupSchema) }).strict(),
);
const groupResponse = component(
  "TodoGroupResponse",
  z.object({ group: todoGroupPlainSchema }).strict(),
);
const groupDetailResponse = component(
  "TodoGroupDetailResponse",
  z.object({ group: todoGroupPlainSchema, members: z.array(todoMemberSchema) }).strict(),
);
const deletedResponse = component(
  "TodoDeletedResponse",
  z.object({ deleted: z.literal(true) }).strict(),
);
const membersResponse = component(
  "TodoMembersResponse",
  z.object({ members: z.array(todoMemberSchema) }).strict(),
);
const tasksResponse = component(
  "TodoTasksResponse",
  z.object({ tasks: z.array(todoTaskSchema), nextCursor: z.string().nullable() }).strict(),
);
const taskResponse = component(
  "TodoTaskResponse",
  z.object({ task: todoTaskSchema }).strict(),
);
const taskDetailResponse = component(
  "TodoTaskDetailResponse",
  z.object({ task: todoTaskSchema, occurrences: z.array(todoOccurrenceSchema) }).strict(),
);
const requestsResponse = component(
  "TodoRequestsResponse",
  z.object({ requests: z.array(todoRequestSchema) }).strict(),
);
const requestResponse = component(
  "TodoRequestResponse",
  z.object({ request: todoRequestSchema }).strict(),
);
const categoriesResponse = component(
  "TodoCategoriesResponse",
  z.object({ categories: z.array(todoCategorySchema) }).strict(),
);
const boardResponse = component(
  "TodoBoardResponse",
  z.object({ board: todoBoardSchema }).strict(),
);
const seasonResponse = component(
  "TodoSeasonResponse",
  z.object({ season: todoSeasonSchema }).strict(),
);
const seasonsResponse = component(
  "TodoSeasonsResponse",
  z.object({ seasons: z.array(todoSeasonSchema) }).strict(),
);

/**
 * `POST /groups/{id}/tasks`, `POST /tasks/{id}/complete` and
 * `POST /tasks/{id}/requests` require an `Idempotency-Key` header (8..120
 * characters); the generator has no header slot yet, so it is stated here.
 */
export const TODO_OPERATIONS: readonly OpenApiOperation[] = [
  {
    method: "get",
    path: "/todo/groups",
    summary: "My groups plus the personal one (created on first call).",
    scopes: ["groups:read"],
    response: groupsResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/groups",
    summary: "Create a group; the caller joins as its owner.",
    scopes: ["groups:write"],
    request: createGroup,
    response: groupResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}",
    summary: "A group the caller belongs to, with its members.",
    scopes: ["groups:read"],
    response: groupDetailResponse,
    auth: "session",
  },
  {
    method: "patch",
    path: "/todo/groups/{id}",
    summary: "Rename, change the timezone or configure power (owner).",
    scopes: ["groups:write"],
    request: updateGroup,
    response: groupResponse,
    auth: "session",
  },
  {
    method: "delete",
    path: "/todo/groups/{id}",
    summary: "Delete a group and its tasks; never the personal one (owner).",
    scopes: ["groups:write"],
    response: deletedResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}/members",
    summary: "Members of a group.",
    scopes: ["groups:read"],
    response: membersResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/groups/{id}/members",
    summary: "Add a registered user to the group (owner).",
    scopes: ["groups:write"],
    request: addMember,
    response: membersResponse,
    auth: "session",
  },
  {
    method: "delete",
    path: "/todo/groups/{id}/members/{userId}",
    summary: "Remove a member; their tasks become free (owner).",
    scopes: ["groups:write"],
    response: membersResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}/tasks",
    summary: "The group's tasks, newest first, with filters and a cursor.",
    scopes: ["tasks:read"],
    query: taskQuery,
    response: tasksResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/groups/{id}/tasks",
    summary: "Create a task; requires Idempotency-Key.",
    scopes: ["tasks:write"],
    request: createTask,
    response: taskResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/tasks/{id}",
    summary: "A task and the history of its periods.",
    scopes: ["tasks:read"],
    response: taskDetailResponse,
    auth: "session",
  },
  {
    method: "patch",
    path: "/todo/tasks/{id}",
    summary: "Edit a free task (any member) or a held one (its holder).",
    scopes: ["tasks:write"],
    request: updateTask,
    response: taskResponse,
    auth: "session",
  },
  {
    method: "delete",
    path: "/todo/tasks/{id}",
    summary: "Delete a pending task; a done one stays and counts.",
    scopes: ["tasks:write"],
    response: deletedResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/tasks/{id}/claim",
    summary: "Take a free task.",
    scopes: ["tasks:write"],
    response: taskResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/tasks/{id}/release",
    summary: "Its holder makes the task free again.",
    scopes: ["tasks:write"],
    response: taskResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/tasks/{id}/complete",
    summary: "Its holder completes it; requires Idempotency-Key.",
    scopes: ["tasks:write"],
    response: taskResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/tasks/{id}/reopen",
    summary: "Undo a completion while its season is still open.",
    scopes: ["tasks:write"],
    response: taskResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/tasks/{id}/requests",
    summary: "Ask the holder for the task; requires Idempotency-Key.",
    scopes: ["tasks:write"],
    response: requestResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/requests",
    summary: "The inbox: requests asked of me or asked by me.",
    scopes: ["tasks:read"],
    query: requestQuery,
    response: requestsResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/requests/{id}/accept",
    summary: "The holder accepts and the task moves to the requester.",
    scopes: ["tasks:write"],
    response: requestResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/requests/{id}/deny",
    summary: "The holder denies; nothing changes.",
    scopes: ["tasks:write"],
    response: requestResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}/power",
    summary: "The ranking of the season in progress.",
    scopes: ["power:read"],
    response: boardResponse,
    auth: "session",
  },
  {
    method: "post",
    path: "/todo/groups/{id}/season/close",
    summary: "Close the season, archive the ranking and start from zero (owner).",
    scopes: ["groups:write"],
    response: boardResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}/seasons",
    summary: "The season archive.",
    scopes: ["power:read"],
    response: seasonsResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/groups/{id}/seasons/{number}",
    summary: "One archived season with its ranking.",
    scopes: ["power:read"],
    response: seasonResponse,
    auth: "session",
  },
  {
    method: "get",
    path: "/todo/categories",
    summary: "The instance's category catalog.",
    scopes: ["tasks:read"],
    response: categoriesResponse,
    auth: "session",
  },
];
