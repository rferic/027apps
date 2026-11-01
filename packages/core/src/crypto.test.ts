import { describe, expect, it } from 'vitest';
import { createSettingsEncryption } from './crypto';

const KEY = Buffer.alloc(32, 7).toString('base64'); // 32 bytes, deterministic test key
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

describe('createSettingsEncryption (AES-256-GCM, format v1)', () => {
  it('encrypts and decrypts a round trip', async () => {
    const crypto = createSettingsEncryption(KEY);
    const slot = 'notifications.push.fcm_service_account';

    const encrypted = await crypto.encrypt('{"type":"service_account"}', slot);

    expect(encrypted).toMatch(/^v1:/);
    await expect(crypto.decrypt(encrypted, slot)).resolves.toBe('{"type":"service_account"}');
  });

  it('produces different ciphertexts for the same plaintext (fresh nonce per encryption)', async () => {
    const crypto = createSettingsEncryption(KEY);
    const slot = 'instance.name';

    const first = await crypto.encrypt('same plaintext', slot);
    const second = await crypto.encrypt('same plaintext', slot);

    expect(first).not.toBe(second);
    await expect(crypto.decrypt(first, slot)).resolves.toBe('same plaintext');
    await expect(crypto.decrypt(second, slot)).resolves.toBe('same plaintext');
  });

  it('binds the ciphertext to its slot: decrypting in another slot fails (returns null)', async () => {
    const crypto = createSettingsEncryption(KEY);
    const encrypted = await crypto.encrypt('secret value', 'notifications.push.fcm_service_account');

    // Swapping slots (e.g. decrypting the FCM secret as SMTP) must not yield plaintext.
    await expect(crypto.decrypt(encrypted, 'smtp.password')).resolves.toBeNull();
    await expect(crypto.decrypt(encrypted, 'notifications.push.fcm_service_account')).resolves.toBe('secret value');
  });

  it('format is versioned: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>', async () => {
    const crypto = createSettingsEncryption(KEY);
    const encrypted = await crypto.encrypt('value', 'instance.name');

    const parts = encrypted.split(':');
    expect(parts[0]).toBe('v1');
    expect(parts).toHaveLength(4);
    // iv is 12 bytes base64, tag is 16 bytes base64.
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16);
    expect(Buffer.from(parts[3], 'base64').length).toBeGreaterThan(0);
  });

  it('rotation: re-encrypting the same plaintext produces a different ciphertext that decrypts the same', async () => {
    const crypto = createSettingsEncryption(KEY);
    const slot = 'notifications.push.fcm_api_key';

    const original = await crypto.encrypt('AIzaOriginalKey', slot);
    const plaintext = await crypto.decrypt(original, slot);
    expect(plaintext).toBe('AIzaOriginalKey');
    if (plaintext === null) throw new Error('decrypt must not return null for a valid ciphertext');

    const rotated = await crypto.encrypt(plaintext, slot);
    expect(rotated).not.toBe(original);
    await expect(crypto.decrypt(rotated, slot)).resolves.toBe('AIzaOriginalKey');
  });

  it('decrypting with an incorrect key returns null (does not throw, does not leak)', async () => {
    const crypto = createSettingsEncryption(KEY);
    const encrypted = await crypto.encrypt('private key material', 'smtp.password');

    const wrongKey = createSettingsEncryption(OTHER_KEY);
    await expect(wrongKey.decrypt(encrypted, 'smtp.password')).resolves.toBeNull();
  });

  it('rejects a non-32-byte key at construction', () => {
    expect(() => createSettingsEncryption(Buffer.alloc(16, 1).toString('base64'))).toThrow();
    expect(() => createSettingsEncryption('not-base64!')).toThrow();
  });

  it('decrypt rejects malformed input (returns null, not throw)', async () => {
    const crypto = createSettingsEncryption(KEY);
    await expect(crypto.decrypt('garbage', 'instance.name')).resolves.toBeNull();
    await expect(crypto.decrypt('v2:aaa:bbb:ccc', 'instance.name')).resolves.toBeNull();
    await expect(crypto.decrypt('v1:notb64:aa:bb', 'instance.name')).resolves.toBeNull();
  });
});
