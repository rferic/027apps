/**
 * Setup wizard API (instance-config spec §7.2):
 * - `GET /api/v1/setup/environment` — public while the instance is uninstalled.
 * - `POST /api/v1/setup/test-email` — authenticated super_admin, at most 3
 *   attempts per minute; sends the SMTP test to the caller's own address only.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import { DomainError } from '../errors';
import type { Caller, CorsOptions, DoorDeps, LogEntry } from '../api/types';
import { checkEnvironment, type EnvironmentDeps, type EnvironmentReport } from './environment';

export interface SetupRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  env: EnvironmentDeps;
  /** True once an active super_admin exists (the wizard is closed). */
  installed: () => Promise<boolean>;
  cors?: CorsOptions;
}

const TEST_EMAIL_ATTEMPTS_PER_MINUTE = 3;

/** GET /api/v1/setup/environment — 409 `already_setup` once the admin exists. */
export function setupEnvironmentRoute(deps: SetupRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      { scopes: [], auth: deps.auth, cors: deps.cors, rateLimit: { identity: 'ip', limit: 30 } },
      deps.door,
      async (): Promise<{ environment: EnvironmentReport }> => {
        if (await deps.installed()) throw new DomainError('already_setup');
        return { environment: await checkEnvironment(deps.env) };
      },
    );
}

export interface TestEmailDeps {
  /** Sends the SMTP test through the project's mailer to the caller's own email. */
  sendTestEmail(userId: string): Promise<void>;
}

function assertSuperAdmin(caller: Caller): asserts caller is Extract<Caller, { kind: 'session' }> {
  if (caller.kind !== 'session' || caller.role !== 'super_admin') {
    throw new DomainError('insufficient_scope');
  }
}

/**
 * POST /api/v1/setup/test-email — sends a test email to the authenticated
 * super_admin. Rate limited to 3 attempts per minute (M-7); the address is
 * never taken from the request body, so it cannot be abused as an open relay.
 */
export function setupTestEmailRoute(deps: Omit<SetupRouteDeps, 'env'> & TestEmailDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['users:write'],
        auth: deps.auth,
        // The destination is the caller's own address: the body carries nothing.
        schema: z.object({}).strict(),
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: TEST_EMAIL_ATTEMPTS_PER_MINUTE },
      },
      deps.door,
      async (ctx) => {
        assertSuperAdmin(ctx.caller);
        try {
          await deps.sendTestEmail(ctx.caller.userId);
        } catch (err) {
          const entry: LogEntry = {
            level: 'error',
            requestId: ctx.requestId,
            code: 'internal',
            message: "setup test email failed",
          };
          deps.door.logger(entry);
          throw new DomainError('internal', 'Could not send the test email');
        }
        return { sent: true };
      },
    );
}
