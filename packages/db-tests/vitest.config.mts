import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// Carga .env.local del paquete (credenciales de la pila Supabase local) en process.env.
// No sustituye variables ya definidas en el entorno (prioridad al entorno real).
try {
  const content = readFileSync(join(root, '.env.local'), 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {
  // .env.local es opcional: si falta, los tests fallarán con el aviso de pg.ts.
}

export default defineConfig({
  test: {
    // Suite de integración contra la pila Supabase local (supabase start + db reset).
    // Se ejecuta serializado: cada test siembra datos y verifica políticas RLS;
    // no hay paralelismo porque la BD es compartida y el estado importa.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    fileParallelism: false,
  },
});
