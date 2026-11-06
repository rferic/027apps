/**
 * AES-256-GCM encryption for instance settings (instance-config spec §5).
 *
 * - Master key: 32 bytes base64 in `SETTINGS_ENCRYPTION_KEY` (env, never in the
 *   database, git or logs).
 * - Nonce: 12 random bytes (CSPRNG) fresh on EVERY encryption, including all
 *   re-encryption and rotation.
 * - AAD: `<version>|<category_key>.<key>` — binds the ciphertext to its slot so
 *   secrets cannot be swapped between keys (the FCM service account cannot be
 *   decrypted in the SMTP slot).
 * - Versioned format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`; the tag is
 *   verified before any plaintext is returned.
 * - Decryption failure (wrong key, corrupted or malformed input) returns `null`
 *   and never throws: the setting is treated as "not configured" and the value
 *   is never leaked.
 */

import {
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';

const VERSION = 'v1';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptionKeyPort {
  /** Returns the plaintext, or `null` when the ciphertext cannot be trusted. */
  decrypt(valueEncrypted: string, slot: string): Promise<string | null>;
  /** Returns the versioned ciphertext, or `null` when the master key is unusable. */
  encrypt(plaintext: string, slot: string): Promise<string | null>;
}

/**
 * Decodes the base64 master key without throwing: a malformed key means the
 * instance runs degraded. `Buffer.from(…, 'base64')` never throws on bad input;
 * the length check is the actual validation.
 */
function decodeKey(base64Key: string): Buffer | null {
  const key = Buffer.from(base64Key, 'base64');
  return key.length === KEY_LENGTH ? key : null;
}

function aad(slot: string): Buffer {
  return Buffer.from(`${VERSION}|${slot}`, 'utf8');
}

function splitParts(valueEncrypted: string): [string, string, string, string] | null {
  const parts = valueEncrypted.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [version, ivB64, tagB64, ciphertextB64] = parts;
  if (!version || !ivB64 || !tagB64 || !ciphertextB64) return null;
  return [version, ivB64, tagB64, ciphertextB64];
}

function decodeB64(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64');
  } catch {
    return null;
  }
}

export function createSettingsEncryption(base64Key: string): EncryptionKeyPort {
  // Lazy by contract: construction never throws so importing the module cannot
  // crash the whole API when the env key is missing or malformed.
  const key = decodeKey(base64Key);

  return {
    async encrypt(plaintext: string, slot: string): Promise<string | null> {
      if (!key) return null;
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
      cipher.setAAD(aad(slot));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `${VERSION}:${Buffer.from(iv).toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
    },

    async decrypt(valueEncrypted: string, slot: string): Promise<string | null> {
      if (!key) return null;
      const parts = splitParts(valueEncrypted);
      if (!parts) return null;

      const [, ivB64, tagB64, ciphertextB64] = parts;
      const iv = decodeB64(ivB64);
      const tag = decodeB64(tagB64);
      const ciphertext = decodeB64(ciphertextB64);
      if (!iv || !tag || !ciphertext) return null;
      if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

      try {
        const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
        decipher.setAAD(aad(slot));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plaintext.toString('utf8');
      } catch {
        // Wrong key, corrupted ciphertext or AAD mismatch: never leak a plaintext.
        return null;
      }
    },
  };
}
