# Definition of Done

El `estado` de una tarea (en `docs/tasks/`) avanza `pendiente` → `en curso` → `test` → `finalizada`: `test` es la fase de revisión, QA y auditoría tras implementar. Una tarea pasa a `estado: finalizada` solo cuando cumple **todos** los puntos de su tipo. Quien la implementó no puede aprobar su propia revisión ni su propia auditoría: lo hace un agente distinto con ojos nuevos.

Una tarea puede combinar tipos (p. ej. código + docs): cumple la unión.

## Código (feature, bugfix, refactor)

1. Tests escritos primero (TDD); los de bugfix incluyen un test de regresión que falla sin el fix.
2. `pnpm lint`, `pnpm tsc`, `pnpm test` y los builds afectados en verde en local, con la salida leída.
3. CI en verde en el PR (`admin`, `android`, `ios` si existe, `guard-secrets`, `commitlint`) con el título del PR en Conventional Commits.
4. Docs y flujos (`docs/flows/`) actualizados si cambia el comportamiento.
5. **Cumplimiento de ADRs aplicables**: la tarea declara en su frontmatter `adrs: [NNNN, …]` (los ADRs que tocan el cambio, p. ej. `0004` bordes, `0007` errores, `0008` fechas/moneda, `0006` realtime) y su implementación los respeta. Lo mecánico se apoya en los checks deterministas de cada ADR (schemas zod compartidos, reglas ESLint propias, check de i18n); lo no automatizable lo verifica la revisión de ojos nuevos (punto 6). Un cambio no puede contradecir un ADR aprobado sin un ADR nuevo que lo sustituya.
6. **QA con ojos nuevos**: un agente que no escribió el código revisa bugs, casos límite, estilo contra `docs/conventions/code-style.md`, cumplimiento de los ADRs declarados en el frontmatter y los criterios de aceptación de la spec/plan. Los hallazgos se corrigen o se rechazan con motivo.
7. **Changelog de la app**: si el cambio llega a un APK, sube `versionName`/`versionCode` y añade
   su entrada en `apps/android/app/src/main/java/com/rferic/zero27apps/Changelog.kt`, en español
   e inglés, con las notas de lo que el propietario va a notar. `ChangelogTest` falla si la
   versión en curso no tiene entrada; una versión sin changelog no está terminada.
8. **Auditoría de seguridad obligatoria e incondicional (OWASP)** en toda implementación — se ejecuta con la [checklist de seguridad](security-checklist.md) (controles concretos por punto A01–A11, incluido el cliente Android) —feature, bugfix y refactor, sin importar el ámbito del cambio—, por un agente distinto del autor, **antes de marcar `finalizada`** (requisito explícito del usuario). Mínimo:
   - Control de acceso y autorización: ¿cada ruta/acción comprueba quién es y qué puede hacer? (A01)
   - Inyección y validación de entrada: zod en los bordes, consultas parametrizadas, sin HTML/URL sin sanear (A03)
   - Autenticación y gestión de sesión/tokens: caducidad, rotación, revocación; nunca tokens inmortales (A07)
   - Exposición de datos: respuestas sin campos de más, errores sin detalles internos, sin secretos en cliente (`NEXT_PUBLIC_*`), logs o git (A02, A05)
   - Configuración segura y cadena de suministro: dependencias nuevas justificadas, acciones de CI de terceros fijadas por SHA de commit (las `actions/*` de GitHub pueden ir en tag mayor), permisos mínimos (A05, A06, A08)
   - Registro y diseño inseguro: fallos explícitos, límites de uso (rate limiting) en superficies públicas (A04, A09)

   El resultado queda por escrito (hallazgos, severidad, resolución) en el informe de la tarea/PR. Hallazgos críticos o altos sin resolver bloquean `finalizada`.

## App móvil (Android e iOS)

Se suma a lo anterior cuando el cambio toca una app. Flujo completo en [móvil](../flows/mobile.md);
matriz en [`docs/ai/parity.md`](../ai/parity.md).

1. **Escenario antes que código**: toda regla, validación, estado, texto de push o flujo nuevo o
   cambiado tiene su escenario o fixture en `spec/mobile/` en el mismo PR, y la suite Kotlin lo
   ejecuta. Sin escenario no es contrato.
2. **Fila de paridad**: la capacidad tocada existe en `docs/ai/parity.md` con su estado por
   plataforma. `pnpm check:parity` en verde: una fila `android: hecho` sin `ios: hecho` exige motivo
   en `divergencia` y sprint asignado.
3. **Divergencias declaradas**: una diferencia de plataforma (actualización, widget, deep links,
   ATS, push) va a la tabla de la [spec iOS](../superpowers/specs/2026-11-21-ios-app.md#8-divergencias-aceptadas-por-plataforma)
   y a la matriz con su motivo. No se implementa en silencio.
4. **Generado al día**: `pnpm gen:mobile --check` en verde. Textos, tokens y DTOs no se editan a mano
   en ninguna plataforma.
5. **Release móvil**: si el cambio llega a un build, sube la versión y añade su entrada al changelog
   de cada app que lo reciba (en Android, `ChangelogTest` lo exige).
6. **Verificación iOS**: puertas G0, G2 y G3 del [flujo móvil](../flows/mobile.md). Excepción
   aprobada por el propietario (2026-11-21): **no hay revisión humana del código Swift**; la
   sustituyen los escenarios compartidos, el XCUITest de humo, la auditoría de seguridad con
   checklist iOS y las puertas humanas G1/G2/G3.
7. **Auditoría de seguridad iOS** además de la general: token solo en Keychain, sin fugas por deep
   links ni logs, ATS limitado a hosts privados, sin secretos en el binario.

## Entrega al propietario

1. **Verificación previa ejecutada**, no prometida: `scripts/verify-local.sh` en verde y la
   checklist de `docs/flows/pre-delivery-verification.md` completada (suites, build, rutas del
   panel con sesión, endpoints, APK instalado si toca). La salida se pega en la tarea/PR.
2. Un error encontrado ahí se corrige y se cubre con un test de regresión o una comprobación del
   script antes de volver a anunciar nada.

## Docs

1. Revisada por un segundo agente: coherencia con la spec, los flujos y el código real.
2. Rutas, comandos y nombres citados verificados contra el repo.
3. Sin contradicciones con `AGENTS.md` ni `docs/conventions/*`.
4. Si documenta algo que toca credenciales, tokens o configuración sensible: auditoría de seguridad como en Código (punto 7).

## Infra (CI, deploy, config, dependencias)

1. Cumple los puntos 2–4 de Código, y `docs/flows/` refleja el cambio.
2. Evidencia real de comportamiento: el check falla cuando debe fallar y pasa cuando debe pasar (salida de `gh pr checks`, logs de run), no solo "verde".
3. **Auditoría de seguridad (OWASP)** como en Código (punto 7), con énfasis en secretos, permisos del workflow, `pull_request_target`, acciones de terceros y exposición de credenciales.

## Diseño (identidad, tokens, mockups)

1. Mockup/propuesta aceptado explícitamente por el usuario (en el PR o la sesión), no asumido.
2. Tokens con valores claro y oscuro; contraste verificado en ambos modos.
3. Si el diseño se implementa como código, aplica además Código.
