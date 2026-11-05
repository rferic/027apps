import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import { withClient, query, count, impersonate, impersonateAnon, createTestUser, createTestModule } from "../pg.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seedUser(c: ClientBase, role: "admin" | "user", name: string) {
  return createTestUser(c, {
    email: `rls-inv-${name}-${uniq()}@test.local`,
    displayName: name,
    role,
  });
}

async function seedInvitation(c: ClientBase, createdBy: string): Promise<string> {
  const { rows } = await query(
    c,
    `insert into public.invitations (email, name, token_hash, expires_at, created_by)
     values ($1, $2, $3, now() + interval '1 day', $4) returning id`,
    [
      `guest-${uniq()}@test.local`,
      "Guest",
      // 64 hex chars: shape matches the token_hash CHECK.
      `${uniq().replace(/[^0-9a-f]/gi, "").padEnd(64, "0").slice(0, 64)}`,
      createdBy,
    ],
  );
  return String(rows[0]!.id);
}

describe("RLS: invitations", () => {
  it("an admin reads and writes invitations", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Inv Admin");
      const invitation = await seedInvitation(c, admin.id);
      await query(c, "insert into public.invitation_modules (invitation_id, module_key) values ($1, 'expenses')", [
        invitation,
      ]);

      await impersonate(c, admin.id);
      await expect(count(c, "select count(*) from public.invitations")).resolves.toBe(1);
      await expect(count(c, "select count(*) from public.invitation_modules")).resolves.toBe(1);
      await expect(
        query(c, "update public.invitations set name = 'Guest 2' where id = $1 returning id", [invitation]),
      ).resolves.toMatchObject({ rows: [{ id: invitation }] });
      await c.query("ROLLBACK");
    });
  });

  it("a plain user cannot read or create invitations", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Inv Admin 2");
      const plain = await seedUser(c, "user", "RLS Inv Plain");
      await seedInvitation(c, admin.id);

      await impersonate(c, plain.id);
      await expect(count(c, "select count(*) from public.invitations")).resolves.toBe(0);

      await c.query("SAVEPOINT sp_insert");
      await expect(
        query(
          c,
          `insert into public.invitations (email, name, token_hash, expires_at, created_by)
           values ('x@test.local', 'X', repeat('a', 64), now() + interval '1 day', $1)`,
          [plain.id],
        ),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_insert");
      await c.query("ROLLBACK");
    });
  });

  it("anon has no privileges on invitations", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      await impersonateAnon(c);
      await expect(query(c, "select count(*) from public.invitations")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
  });
});
