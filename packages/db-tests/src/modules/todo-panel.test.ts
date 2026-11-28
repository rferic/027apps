import { describe, expect, it } from "vitest";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import { completeTask, createTask } from "@027apps/todo/domain/tasks.js";
import { deleteCategory, listCategories, saveCategory } from "@027apps/todo/domain/categories.js";
import { panelOverview } from "@027apps/todo/domain/panel.js";

const TZ = "Europe/Madrid";
const clock = () => new Date("2026-11-27T10:00:00Z");

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "none";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

describe("todo panel", () => {
  it("summarises the groups of the instance, with their counts", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };

      const group = await createGroup(deps, me, { name: "🏠 Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);
      const one = await createTask(deps, me, group.id, {
        title: "Pintar la valla",
        assigneeId: ana.userId,
      });
      await createTask(deps, me, group.id, { title: "Comprar detergente" });
      await completeTask(deps, me, one.id);

      const overview = await panelOverview(deps);
      const row = overview.groups.find((candidate) => candidate.id === group.id);
      expect(row).toMatchObject({
        name: "🏠 Casa",
        kind: "group",
        memberCount: 2,
        pending: 1,
        done: 1,
        powerEnabled: false,
      });
      expect(overview.pending).toBe(1);
      expect(overview.done).toBe(1);
    });
  });

  it("administers the catalog: create, duplicate, delete", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c, clock);

      const created = await saveCategory(deps, {
        name: "Jardín",
        emoji: "🌿",
        color: "emerald",
        sortOrder: 10,
      });
      expect(created.name).toBe("Jardín");
      expect((await listCategories(deps)).map((category) => category.name)).toEqual(["Jardín"]);

      expect(
        await codeOf(() => saveCategory(deps, { name: "Jardín", emoji: "🌿", color: "teal" })),
      ).toBe("validation_failed");
      expect(
        await codeOf(() => saveCategory(deps, { name: "🌿".repeat(41), emoji: "🌿", color: "teal" })),
      ).toBe("validation_failed");

      const renamed = await saveCategory(deps, {
        id: created.id,
        name: "Huerto",
        emoji: "🥬",
        color: "teal",
      });
      expect(renamed.name).toBe("Huerto");

      await deleteCategory(deps, created.id);
      expect(await listCategories(deps)).toEqual([]);
      expect(await codeOf(() => deleteCategory(deps, created.id))).toBe("not_found");
    });
  });
});
