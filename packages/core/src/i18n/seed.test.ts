import { describe, it, expect } from 'vitest';
import { sha256 } from '../i18n/seed.js';

describe('i18n seed', () => {
  describe('sha256', () => {
    it('computes SHA-256 hash correctly', () => {
      const input = 'Hello World';
      const hash = sha256(input);
      expect(hash).toHaveLength(64); // hex-encoded SHA-256
      expect(hash).toBe('a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
    });

    it('produces consistent hashes for same input', () => {
      expect(sha256('test')).toBe(sha256('test'));
    });

    it('produces different hashes for different inputs', () => {
      expect(sha256('test1')).not.toBe(sha256('test2'));
    });
  });
});
