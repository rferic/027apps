import { DomainError } from "@027apps/core/errors.js";
import type { InvitationsAuth } from "@027apps/core/invitations/service.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Supabase Auth adapter for invitation redemption. Auth users live in
 * `auth.users`; profiles are ours. Creation goes through the Admin API so the
 * invitee can sign in immediately with the password chosen in the wizard.
 */
export function createInvitationsAuth(db: Db): InvitationsAuth {
  const admin = createSupabaseAdminClient();

  async function findUserByEmail(email: string): Promise<{ id: string } | null> {
    const { rows } = await db.query("select id from auth.users where email = $1 limit 1", [email]);
    return rows[0] ? { id: String(rows[0].id) } : null;
  }

  return {
    findUserByEmail,

    async createUser({ email, password }) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (!created.error && created.data.user) return { id: created.data.user.id, created: true };

      // The address was already registered. The caller is anonymous (this is
      // the new-account path), so handing back that user id would let a second
      // request redeem the invitation and swallow the account the first one
      // just created. It must sign in instead (D21).
      if (created.error && /already been registered/i.test(created.error.message)) {
        throw new DomainError("existing_account_signin_required");
      }
      throw new Error("createUser failed");
    },

    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error("deleteUser failed");
    },
  };
}
