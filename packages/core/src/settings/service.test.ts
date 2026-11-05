import { describe, expect, it, vi } from 'vitest';
import { recordJwtExpiry } from './service.js';

describe('recordJwtExpiry', () => {
  it('writes the observed expiry with the admin as the audit actor', async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await recordJwtExpiry({ query }, 'admin-1', 900);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('update public.settings'), [
      JSON.stringify(900),
      'admin-1',
      'security.jwt_expiry',
    ]);
  });
});
