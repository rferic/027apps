import { describe, expect, it } from 'vitest';
import { SETTINGS_CATALOG } from './catalog';

describe('public_url schema validation', () => {
  const publicUrlSetting = SETTINGS_CATALOG.find((s) => s.key === 'instance.public_url');
  if (!publicUrlSetting) {
    throw new Error('instance.public_url setting not found in catalog');
  }

  const schema = publicUrlSetting.schema;

  describe('accepts', () => {
    it('https://panel.example.com', () => {
      expect(schema.parse('https://panel.example.com')).toBe('https://panel.example.com');
    });

    it('https://027apps.local', () => {
      expect(schema.parse('https://027apps.local')).toBe('https://027apps.local');
    });

    it('http://027apps.local', () => {
      expect(schema.parse('http://027apps.local')).toBe('http://027apps.local');
    });

    it('http://localhost:3003', () => {
      expect(schema.parse('http://localhost:3003')).toBe('http://localhost:3003');
    });

    it('http://127.0.0.1:3003', () => {
      expect(schema.parse('http://127.0.0.1:3003')).toBe('http://127.0.0.1:3003');
    });

    it('http://192.168.1.50:3003', () => {
      expect(schema.parse('http://192.168.1.50:3003')).toBe('http://192.168.1.50:3003');
    });

    it('http://10.0.0.5:3003', () => {
      expect(schema.parse('http://10.0.0.5:3003')).toBe('http://10.0.0.5:3003');
    });

    it('http://[::1]:3003', () => {
      expect(schema.parse('http://[::1]:3003')).toBe('http://[::1]:3003');
    });

    it('http://app.localhost', () => {
      expect(schema.parse('http://app.localhost')).toBe('http://app.localhost');
    });

    it('http://panel.test', () => {
      expect(schema.parse('http://panel.test')).toBe('http://panel.test');
    });

    it('https://panel.example.com:443', () => {
      expect(schema.parse('https://panel.example.com:443')).toBe('https://panel.example.com:443');
    });

    it('http://localhost:80', () => {
      expect(schema.parse('http://localhost:80')).toBe('http://localhost:80');
    });

    it('http://172.16.0.1', () => {
      expect(schema.parse('http://172.16.0.1')).toBe('http://172.16.0.1');
    });

    it('http://172.31.255.254', () => {
      expect(schema.parse('http://172.31.255.254')).toBe('http://172.31.255.254');
    });
  });

  describe('rejects', () => {
    it('http://panel.example.com (host público con http)', () => {
      const result = schema.safeParse('http://panel.example.com');
      expect(result.success).toBe(false);
    });

    it('http://localhost:3003/ (barra final)', () => {
      const result = schema.safeParse('http://localhost:3003/');
      expect(result.success).toBe(false);
    });

    it('https://panel.example.com/panel (path)', () => {
      const result = schema.safeParse('https://panel.example.com/panel');
      expect(result.success).toBe(false);
    });

    it('ftp://panel.example.com', () => {
      const result = schema.safeParse('ftp://panel.example.com');
      expect(result.success).toBe(false);
    });

    it('http://no-es-una-url', () => {
      const result = schema.safeParse('http://no-es-una-url');
      expect(result.success).toBe(false);
    });

    it('http://172.15.0.1 ( fuera de rango 172.16-31)', () => {
      const result = schema.safeParse('http://172.15.0.1');
      expect(result.success).toBe(false);
    });

    it('http://172.32.0.1 (fuera de rango 172.16-31)', () => {
      const result = schema.safeParse('http://172.32.0.1');
      expect(result.success).toBe(false);
    });

    it('http://localhost:3003/path (con path)', () => {
      const result = schema.safeParse('http://localhost:3003/path');
      expect(result.success).toBe(false);
    });

    it('http://localhost:3003?x=1 (con query)', () => {
      const result = schema.safeParse('http://localhost:3003?x=1');
      expect(result.success).toBe(false);
    });

    it('http://user:pass@localhost:3003 (con userinfo)', () => {
      const result = schema.safeParse('http://user:pass@localhost:3003');
      expect(result.success).toBe(false);
    });

    it('http://[::1]:3003/ (barra final en IPv6)', () => {
      const result = schema.safeParse('http://[::1]:3003/');
      expect(result.success).toBe(false);
    });

    it('https://panel.example.com:8443/ (path con puerto no por defecto)', () => {
      const result = schema.safeParse('https://panel.example.com:8443/');
      expect(result.success).toBe(false);
    });

    it('http://.local (hostname empieza con .)', () => {
      const result = schema.safeParse('http://.local');
      expect(result.success).toBe(false);
    });

    it('http://foo..local (hostname contiene ..)', () => {
      const result = schema.safeParse('http://foo..local');
      expect(result.success).toBe(false);
    });

    it('http://0x7f.0.0.1 (notación IP no canónica)', () => {
      const result = schema.safeParse('http://0x7f.0.0.1');
      expect(result.success).toBe(false);
    });

    it('http://2130706433 (integer IP)', () => {
      const result = schema.safeParse('http://2130706433');
      expect(result.success).toBe(false);
    });
  });

  describe('error message mentions https', () => {
    it('includes "https" in error message for invalid http public host', () => {
      const result = schema.safeParse('http://panel.example.com');
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toMatch(/https/i);
    });
  });
});
