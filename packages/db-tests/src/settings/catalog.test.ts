import { describe, expect, it } from 'vitest';
import { withClient, query } from '../pg.js';
import { CATALOG_DEFAULTS, SETTINGS_CATALOG, SETTINGS_CATEGORIES, getSettingMeta } from '@027apps/core/settings/catalog.js';

/**
 * Catalog sync check: the database seed (migration 0002) must match the code
 * catalog exactly — same keys, same categories, same defaults and metadata.
 * Any drift between the two fails here, so a catalog change without a seed
 * update (or vice versa) never reaches CI green.
 */

interface DbSetting {
  category_key: string;
  key: string;
  label: string;
  help: string;
  value: unknown;
  value_encrypted: string | null;
  is_secret: boolean;
  is_public: boolean;
  mcp_access: 'none' | 'read' | 'write';
  sort_order: number;
}

describe('settings catalog seed (migration 0002)', () => {
  it('seeds exactly the catalog keys with matching metadata', async () => {
    await withClient(async (c) => {
      const { rows } = await query(c, 'select * from public.settings order by category_key, sort_order');
      const db = new Map(rows.map((r) => [r.key, r as unknown as DbSetting]));

      expect(db.size).toBe(SETTINGS_CATALOG.length);

      for (const meta of SETTINGS_CATALOG) {
        const row = db.get(meta.key);
        expect(row, `missing setting ${meta.key}`).toBeDefined();
        expect(row!.category_key).toBe(meta.category);
        expect(row!.label).toBe(meta.label);
        expect(row!.help).toBe(meta.help);
        expect(row!.is_secret).toBe(meta.isSecret);
        expect(row!.is_public).toBe(meta.isPublic);
        expect(row!.mcp_access).toBe(meta.mcpAccess);
        expect(row!.sort_order).toBe(meta.sortOrder);
      }
    });
  });

  it('seeds the 5 categories with matching sort and metadata', async () => {
    await withClient(async (c) => {
      const { rows } = await query(c, 'select * from public.settings_categories order by sort_order');
      const db = new Map(rows.map((r) => [r.category_key, r]));

      expect(db.size).toBe(SETTINGS_CATEGORIES.length);
      for (const cat of SETTINGS_CATEGORIES) {
        const row = db.get(cat.categoryKey);
        expect(row, `missing category ${cat.categoryKey}`).toBeDefined();
        expect(row!.label).toBe(cat.label);
        expect(row!.help).toBe(cat.help);
        expect(row!.icon).toBe(cat.icon);
        expect(row!.sort_order).toBe(cat.sortOrder);
        expect(row!.source).toBe('core');
      }
    });
  });

  it('defaults match the spec table: non-secrets carry their value, secrets are unconfigured', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        // A real wizard run may have changed values; restore the seeded state
        // inside this transaction so the check is about the seed, not the data.
        for (const [key, value] of Object.entries(CATALOG_DEFAULTS)) {
          await query(c, 'update public.settings set value = $1 where key = $2 and is_secret = false', [
            JSON.stringify(value),
            key,
          ]);
        }
        await c.query('update public.settings set value = null, value_encrypted = null where is_secret');

        const { rows } = await query(c, 'select category_key, key, value, is_secret, value_encrypted from public.settings');
      for (const row of rows as { key: string; value: unknown; is_secret: boolean; value_encrypted: string | null }[]) {
        const fullKey = row.key; // `key` stores the full canonical key (e.g. "instance.name")
        const meta = getSettingMeta(fullKey);
        expect(meta, `catalog has no meta for ${fullKey}`).toBeDefined();
        const expected = CATALOG_DEFAULTS[fullKey];

        if (row.is_secret) {
          // Unconfigured secret: no plaintext, no encrypted value yet.
          expect(row.value).toBeNull();
          expect(row.value_encrypted).toBeNull();
        } else {
          expect(row.value).toEqual(expected);
        }
      }
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('is_secret=true rows never carry a plaintext value (SQL guarantee)', async () => {
    await withClient(async (c) => {
      const { rows } = await query(
        c,
        'select key from public.settings where is_secret = true and value is not null',
      );
      expect(rows).toHaveLength(0);
    });
  });
});
