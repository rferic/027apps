/**
 * i18n etag computation.
 *
 * Generates an ETag for a translation response body.
 * The ETag is based on the JSON-serialized response body,
 * so any change to translations will change the ETag.
 */

import { createHash } from 'node:crypto';

/**
 * Compute an ETag for a value.
 *
 * Uses SHA-256 of the canonical JSON serialization,
 * formatted as a strong ETag: `"hex-digest"`.
 *
 * @param body - The value to hash (will be JSON.stringify'd)
 * @returns The ETag string (async because JSON.stringify might be async in some contexts)
 */
export function computeEtag(body: unknown): string {
  const json = JSON.stringify(body);
  const hash = createHash('sha256').update(json).digest('hex');
  return `"${hash}"`;
}

/**
 * Parse an ETag string.
 *
 * Returns the hex digest without quotes, or null if invalid.
 */
export function parseEtag(etag: string): string | null {
  if (!etag.startsWith('"') || !etag.endsWith('"')) {
    return null;
  }
  return etag.slice(1, -1);
}
