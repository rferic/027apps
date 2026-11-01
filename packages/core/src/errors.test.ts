import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGES,
  DomainError,
  httpStatusFor,
  toEnvelope,
  type DomainErrorCode,
} from './errors';

const CODES: DomainErrorCode[] = [
  'validation_failed',
  'unauthorized',
  'insufficient_scope',
  'not_found',
  'conflict',
  'rate_limited',
  'already_setup',
  'currency_not_enabled',
  'locale_not_available',
  'internal',
];

describe('DEFAULT_MESSAGES', () => {
  it('has one English message per code', () => {
    expect(Object.keys(DEFAULT_MESSAGES).sort()).toEqual([...CODES].sort());
    for (const code of CODES) expect(DEFAULT_MESSAGES[code]).toMatch(/\S/);
  });
});

describe('DomainError', () => {
  it('carries the code and defaults the message to the catalogue', () => {
    const err = new DomainError('not_found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DomainError');
    expect(err.code).toBe('not_found');
    expect(err.message).toBe(DEFAULT_MESSAGES.not_found);
    expect(err.details).toBeUndefined();
  });

  it('keeps custom details', () => {
    const details = { field: 'email', rule: 'email' };
    const err = new DomainError('validation_failed', undefined, details);
    expect(err.details).toEqual(details);
  });
});

describe('httpStatusFor', () => {
  it('maps each code to its HTTP status', () => {
    expect(httpStatusFor('validation_failed')).toBe(400);
    expect(httpStatusFor('unauthorized')).toBe(401);
    expect(httpStatusFor('insufficient_scope')).toBe(403);
    expect(httpStatusFor('not_found')).toBe(404);
    expect(httpStatusFor('conflict')).toBe(409);
    expect(httpStatusFor('already_setup')).toBe(409);
    expect(httpStatusFor('rate_limited')).toBe(429);
    expect(httpStatusFor('currency_not_enabled')).toBe(400);
    expect(httpStatusFor('locale_not_available')).toBe(400);
    expect(httpStatusFor('internal')).toBe(500);
  });
});

describe('toEnvelope', () => {
  it('produces the ADR 0007 envelope for every domain code', () => {
    for (const code of CODES) {
      const envelope = toEnvelope(new DomainError(code), 'rid-123');
      expect(Object.keys(envelope)).toEqual(['error']);
      expect(envelope.error.code).toBe(code);
      expect(envelope.error.message).toBe(DEFAULT_MESSAGES[code]);
      expect(envelope.error.request_id).toBe('rid-123');
      expect(envelope.error).not.toHaveProperty('details');
    }
  });

  it('forwards validation details', () => {
    const details = { formErrors: [], fieldErrors: { email: ['must be a valid email'] } };
    const envelope = toEnvelope(new DomainError('validation_failed', undefined, details), 'rid');
    expect(envelope.error.details).toEqual(details);
  });

  it('never leaks stack, SQL or internal paths from a DomainError message', () => {
    const err = new DomainError('internal', 'SELECT * FROM users; at /src/db.ts:42');
    err.stack = 'Error: boom\n    at /src/secret.ts:1:1';
    const envelope = toEnvelope(err, 'rid');
    const serialized = JSON.stringify(envelope);
    expect(envelope.error.message).toBe(DEFAULT_MESSAGES.internal);
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('/src/');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
  });

  it('ignores extra enumerable properties attached to the error', () => {
    const err = new DomainError('not_found');
    (err as unknown as Record<string, unknown>).sql = 'SELECT 1';
    (err as unknown as Record<string, unknown>).path = '/internal/db.ts';
    const envelope = toEnvelope(err, 'rid');
    expect(JSON.stringify(envelope)).not.toContain('SELECT');
    expect(JSON.stringify(envelope)).not.toContain('/internal/');
  });

  it('maps unknown errors to internal without internals', () => {
    const envelope = toEnvelope(new Error('SQLSTATE 23505 at /src/db.ts'), 'rid');
    expect(envelope.error.code).toBe('internal');
    expect(envelope.error.message).toBe(DEFAULT_MESSAGES.internal);
    expect(JSON.stringify(envelope)).not.toContain('SQLSTATE');
    expect(JSON.stringify(envelope)).not.toContain('/src/');
  });

  it('maps non-Error throws to internal', () => {
    const envelope = toEnvelope('boom', 'rid');
    expect(envelope.error.code).toBe('internal');
    expect(envelope.error.message).toBe(DEFAULT_MESSAGES.internal);
  });
});
