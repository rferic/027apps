/**
 * Access-token inspection for the setup wizard (instance-config spec §7.2,
 * step 2): the wizard verifies that the Supabase project issues 900 s tokens
 * and records the observed value. The token is decoded, never verified here —
 * Supabase Auth already verified it when the session was created.
 */

/** Value the project must use (spec §7.2; `supabase/config.toml` `jwt_expiry`). */
export const EXPECTED_JWT_EXPIRY_SECONDS = 900;

function decodePayload(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload: unknown = JSON.parse(json);
    return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** `exp − iat` in seconds, or `null` when the token is not a JWT with both claims. */
export function jwtExpirySeconds(accessToken: string): number | null {
  const payload = decodePayload(accessToken);
  const exp = payload?.exp;
  const iat = payload?.iat;
  if (typeof exp !== 'number' || typeof iat !== 'number') return null;
  const seconds = exp - iat;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
