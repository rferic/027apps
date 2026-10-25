# Definition of Done

El `estado` de una tarea (en `docs/tasks/`) avanza `pendiente` → `en curso` → `test` → `finalizada`: `test` es la fase de revisión, QA y auditoría tras implementar. Una tarea pasa a `estado: finalizada` solo cuando cumple **todos** los puntos de su tipo. Quien la implementó no puede aprobar su propia revisión ni su propia auditoría: lo hace un agente distinto con ojos nuevos.

Una tarea puede combinar tipos (p. ej. código + docs): cumple la unión.

## Código (feature, bugfix, refactor)

1. Tests escritos primero (TDD); los de bugfix incluyen un test de regresión que falla sin el fix.
2. `pnpm lint`, `pnpm tsc`, `pnpm test` y los builds afectados en verde en local, con la salida leída.
3. CI en verde en el PR (`admin`, `android`, `guard-secrets`, `commitlint`) con el título del PR en Conventional Commits.
4. Docs y flujos (`docs/flows/`) actualizados si cambia el comportamiento.
5. **QA con ojos nuevos**: un agente que no escribió el código revisa bugs, casos límite y estilo contra `docs/conventions/code-style.md` y los criterios de aceptación de la spec/plan. Los hallazgos se corrigen o se rechazan con motivo.
6. **Auditoría de seguridad obligatoria e incondicional (OWASP)** en toda implementación —feature, bugfix y refactor, sin importar el ámbito del cambio—, por un agente distinto del autor, **antes de marcar `finalizada`** (requisito explícito del usuario). Mínimo:
   - Control de acceso y autorización: ¿cada ruta/acción comprueba quién es y qué puede hacer? (A01)
   - Inyección y validación de entrada: zod en los bordes, consultas parametrizadas, sin HTML/URL sin sanear (A03)
   - Autenticación y gestión de sesión/tokens: caducidad, rotación, revocación; nunca tokens inmortales (A07)
   - Exposición de datos: respuestas sin campos de más, errores sin detalles internos, sin secretos en cliente (`NEXT_PUBLIC_*`), logs o git (A02, A05)
   - Configuración segura y cadena de suministro: dependencias nuevas justificadas, acciones de CI de terceros fijadas por SHA de commit (las `actions/*` de GitHub pueden ir en tag mayor), permisos mínimos (A05, A06, A08)
   - Registro y diseño inseguro: fallos explícitos, límites de uso (rate limiting) en superficies públicas (A04, A09)

   El resultado queda por escrito (hallazgos, severidad, resolución) en el informe de la tarea/PR. Hallazgos críticos o altos sin resolver bloquean `finalizada`.

## Docs

1. Revisada por un segundo agente: coherencia con la spec, los flujos y el código real.
2. Rutas, comandos y nombres citados verificados contra el repo.
3. Sin contradicciones con `AGENTS.md` ni `docs/conventions/*`.
4. Si documenta algo que toca credenciales, tokens o configuración sensible: auditoría de seguridad como en Código (punto 6).

## Infra (CI, deploy, config, dependencias)

1. Cumple los puntos 2–4 de Código, y `docs/flows/` refleja el cambio.
2. Evidencia real de comportamiento: el check falla cuando debe fallar y pasa cuando debe pasar (salida de `gh pr checks`, logs de run), no solo "verde".
3. **Auditoría de seguridad (OWASP)** como en Código (punto 6), con énfasis en secretos, permisos del workflow, `pull_request_target`, acciones de terceros y exposición de credenciales.

## Diseño (identidad, tokens, mockups)

1. Mockup/propuesta aceptado explícitamente por el usuario (en el PR o la sesión), no asumido.
2. Tokens con valores claro y oscuro; contraste verificado en ambos modos.
3. Si el diseño se implementa como código, aplica además Código.
