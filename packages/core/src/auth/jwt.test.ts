import { describe, expect, it } from 'vitest';
import { EXPECTED_JWT_EXPIRY_SECONDS, jwtExpirySeconds } from './jwt.js';

/** Builds an unsigned token with the given payload (signature is irrelevant here). */
function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('jwtExpirySeconds', () => {
  it('returns exp minus iat for a well-formed token', () => {
    expect(jwtExpirySeconds(token({ iat: 1_700_000_000, exp: 1_700_000_900 }))).toBe(900);
  });

  it('matches the value the project must use', () => {
    expect(jwtExpirySeconds(token({ iat: 1_000, exp: 1_000 + EXPECTED_JWT_EXPIRY_SECONDS }))).toBe(
      EXPECTED_JWT_EXPIRY_SECONDS,
    );
  });

  it('returns null when a claim is missing', () => {
    expect(jwtExpirySeconds(token({ iat: 1_700_000_000 }))).toBeNull();
    expect(jwtExpirySeconds(token({ exp: 1_700_000_900 }))).toBeNull();
  });

  it('returns null for a non-JWT string', () => {
    expect(jwtExpirySeconds('not-a-token')).toBeNull();
    expect(jwtExpirySeconds('a.b')).toBeNull();
  });

  it('returns null when the payload is not decodable JSON', () => {
    expect(jwtExpirySeconds('a.%%%.c')).toBeNull();
  });

  it('ignores non-numeric claims', () => {
    expect(jwtExpirySeconds(token({ iat: '1000', exp: '1900' }))).toBeNull();
  });
});
