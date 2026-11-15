import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// Loads the package's .env.local (local Supabase stack credentials) into process.env.
// Does not override variables already defined in the environment (real environment takes priority).
try {
  const content = readFileSync(join(root, '.env.local'), 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {
  // .env.local is optional: if missing, tests fail with the pg.ts warning.
}

export default defineConfig({
  test: {
    // Integration suite against the local Supabase stack (supabase start + db reset).
    // Runs serialized: each test seeds data and verifies RLS policies;
    // no parallelism because the database is shared and state matters.
    include: ['src/**/*.test.ts'],
    // Cleans the accounts a few suites commit through the app's real pool.
    globalSetup: ['./src/global-setup.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    fileParallelism: false,
  },
});
