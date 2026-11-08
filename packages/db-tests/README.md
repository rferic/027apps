# db-tests

Suite de integración contra el Postgres local de Supabase; la guarda de `src/pg.ts` rechaza cualquier URL que no sea local, así que nunca toca un proyecto cloud.

## Cómo se ejecuta

```bash
supabase start          # o: supabase db reset
pnpm --filter db-tests test
```

## Base limpia

Los tests escriben y leen ajustes globales y datos compartidos, y **asumen una base recién reseteada**. Contra una instancia ya configurada (asistente completado, categorías o módulos creados) fallan tres tests conocidos, sin que el código tenga un defecto:

- `src/api/instance.test.ts` — «exposes version, derived setup state and public settings only»: los ajustes públicos ya no son los del seed.
- `src/rls/user-categories.test.ts` — «an admin manages categories and reads every grant»: hay categorías creadas a mano.
- `src/settings/service.test.ts` — «rejects a service account whose project_id does not match fcm_project_id»: el proyecto FCM ya está configurado.

Si aparecen, `supabase db reset` los elimina (ojo: borra también el usuario y los datos locales). En CI la base siempre es nueva, así que el job `supabase` debe quedarse en verde; si falla, es un defecto real.

## Nota de aislamiento

Es deuda conocida: estos tres tests deberían crear y limpiar sus propios datos en lugar de asumir el seed. Cualquier test nuevo debe usar transacciones con `ROLLBACK` como el resto de la suite.
