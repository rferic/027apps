# Mockup — invitación, sesión y migración de teléfono

Mockup de la **tarea 02** del sprint 16. No es una imagen ni UI implementada: es un HTML+JS
navegable para que el propietario recorra los flujos y apruebe el diseño antes de escribir código
de interfaz.

> **Estado:** pendiente de aprobación del propietario (P2). Sin esta aprobación no empieza la UI
> de las tareas 06, 07, 08 y 10.
> **Spec:** [`2026-11-16-invitation-session-migration-design.md`](../../superpowers/specs/2026-11-16-invitation-session-migration-design.md)
> **Plan:** [`2026-11-16-invitation-session-migration.md`](../../superpowers/plans/2026-11-16-invitation-session-migration.md)

## Cómo abrirlo

```bash
open docs/mockups/invitation-flow/index.html
```

Arriba hay tres controles de revisión, fuera del producto:

- **Superficie:** App, Web, Migración QR o Recuperación.
- **Estado:** cada pantalla y sus estados de error.
- **Tema:** claro/oscuro.

La URL guarda la selección: `?surface=app&state=existing&theme=dark`. Los datos son de demo
(**Ana**, **Familia Pérez**, **Eric**), no de la familia. El QR es un patrón de ejemplo, no
escaneable; la implementación usará un QR real.

Para capturas, `?embed=1` oculta la barra de revisión y las notas y deja solo el marco del
producto. Las previews de esta carpeta se generaron así:

| Archivo | Qué es |
|---|---|
| `preview-app-new.png` | App, cuenta nueva, claro (500×950; contenido del móvil 390 px). |
| `preview-app-existing-dark.png` | App, cuenta existente, oscuro. |
| `preview-web-android.png` | Web móvil, aviso Android 8+ y canje. |
| `preview-web-desktop.png` | Web escritorio, formulario + QR (1440×1000). |
| `preview-qr-old.png` | Móvil viejo, QR con cuenta atrás y autoregeneración. |
| `preview-qr-new-entry.png` | Móvil nuevo, entrada desde el login de la app. |
| `preview-reset-email.png` | Email de recuperación (700×900). |

## Qué se revisa

### App · aceptación

| Estado | Qué muestra |
|---|---|
| Cargando | Wordmark + instancia; spinner; sin pedir email ni nombre. |
| Cuenta nueva | Ficha con email, nombre, instancia, invitador, caducidad y rol + contraseña y confirmación. |
| Cuenta existente | Misma ficha + contraseña actual + «¿Olvidaste tu contraseña?»; sin confirmación. |
| Caducada | Sin formulario; pide una nueva a Eric; el panel puede renovarla. |
| Ya aceptada | Sin formulario; iniciar sesión o recuperar contraseña. |
| Inválida/revocada | Tarjeta genérica, sin PII ni distinción. |
| Error de red | Reintentar; la sesión no se toca. |
| Canje correcto | Auto-login; «Ya estás dentro». |
| Canje ok, login fallido | «Tu cuenta se creó»; iniciar sesión, sin reintentar el canje. |
| Sin conexión (shell) | «Tu sesión sigue guardada»; reintentar, sin pedir login. |
| Sesión revocada | «Este teléfono ya no tiene sesión»; volver a entrar. |

### Web · wizard

| Estado | Qué muestra |
|---|---|
| Android paso 1 | Aviso «solo app Android (8+)», abrir en app, descargar, continuar en el navegador. |
| Android paso 2 | Descarga del APK, versión, tamaño, instrucciones de orígenes desconocidos. |
| Android paso 3 | Reintento de apertura con timeout y tres salidas: reintentar, descargar, continuar. |
| Android formulario (nueva) | Ficha + contraseña + confirmación. |
| Android formulario (existente) | Ficha + contraseña actual + recuperación. |
| iPhone | Sin descarga; aviso de Android y canje en el navegador. |
| Escritorio | Dos columnas: ficha/formulario y QR con instrucciones; el canje web sigue completo. |
| Caducada / usada / inválida | Mismos estados que la app. |
| Bienvenida (`user`) | Cuenta creada, descarga de la app y login; el panel es solo para administradores. |

### Migración QR

| Estado | Qué muestra |
|---|---|
| Móvil viejo · entrada | Ajustes con «Mover a otro teléfono»; solo Android. |
| Móvil viejo | QR en tarjeta blanca, cuenta, instancia, cuenta atrás y autoregeneración. |
| Móvil nuevo · entrada | Login de la app, visible **sin sesión**, con «Mover desde otro teléfono». |
| Móvil nuevo · escáner | Escáner in-app, instancia, aviso de cerrar sesión si ya hay una. |
| Móvil nuevo · éxito | La cuenta se movió; el viejo se cerró. |
| Móvil nuevo con sesión | «Cierra sesión primero»; no se cambia de cuenta en silencio. |

### Recuperación

| Estado | Qué muestra |
|---|---|
| Login | Localizado, wordmark + instancia, «¿Olvidaste tu contraseña?». |
| Solicitud | Email + mensaje neutro; no revela si existe. |
| Enviado | «Revisa tu correo»; enlace de 1 h, un solo uso. |
| Email | Plantilla propia con wordmark, instancia, CTA, fallback, caducidad y aviso de seguridad. |
| Confirmar | Página con botón «Continuar»; el GET no consume el token. |
| Nueva contraseña | Contraseña + confirmación, 12–200; aviso de cierre de otras sesiones. |
| Éxito | Contraseña actualizada; volver al login. |

## Decisiones reflejadas

- **A5 / U4:** los datos de la invitación son una ficha (label + valor), no inputs deshabilitados.
  Solo las contraseñas son inputs; el email y el nombre se pueden leer/copiar y no se editan.
- **A5:** confirmación de contraseña solo en cuenta nueva; la cuenta existente usa la contraseña
  actual y no la cambia.
- **A7 / U2:** cuenta existente con «¿Olvidaste tu contraseña?»; si la contraseña falla, la
  invitación no se consume.
- **A2 / U3:** la ficha y el idioma salen del preview de la invitación, no de la cookie del
  navegador; el email y la web coinciden.
- **A4:** wordmark/icono + `instance.name` en app, web y email; sin logo configurable.
- **A1 / U7:** el admin va a `/panel`; un `user` va a `/welcome` con la descarga y el login.
- **Wizard / U6:** «Continuar en el navegador» siempre visible; «Abrir en la app» solo tras clic y
  con timeout; nunca hay bucle.
- **QR / U1:** 60 s por código, autoregeneración a los ~45 s mientras la pantalla está abierta; el
  código anterior sigue válido hasta su TTL.
- **QR / U5:** tarjeta blanca con quiet zone en claro y oscuro; `FLAG_SECURE` en la app real (no
  se puede representar en el mockup).
- **Reset / S2:** `/auth/confirm` es una página con botón; el enlace no se consume al cargar.
- **Reset / S3:** el copy y el tiempo de respuesta son neutros exista o no el email.
- **Sesión / S4:** el shell sin conexión conserva la sesión; la revocada limpia y pide login.

## Tokens y contraste

- Paleta de identidad **D**, espejo de `apps/admin/tokens.json`; claro y oscuro. Los colores de
  producto son tokens; el marco del móvil/ventana, el QR (blanco/negro) y el email usan valores
  propios de su soporte, no de la UI.
- Los pares texto/fondo son los del design system (`foreground`/`background`,
  `muted-foreground`/`surface`, `accent`/`accent-foreground`, `destructive` sobre
  `destructive-subtle`). El mockup no introduce combinaciones nuevas.
- Los controles miden 48 px y usan 16 px de texto en web para no provocar zoom en iOS; el foco es
  visible (`:focus-visible`) en campos, botones y enlaces.
- Los importes/fechas no aplican; la caducidad se muestra con el locale y la zona de la instancia
  (`Europe/Madrid`).
- El QR se pinta sobre blanco también en oscuro: un QR invertido no se escanea.

## Lo que no cubre

- Un QR real escaneable; el del mockup es decorativo.
- Los 9 idiomas: el copy está en español para revisar tono; las claves se traducen en la
  implementación.
- El `FLAG_SECURE` real, el permiso de cámara y el escáner nativo (se revisan en la tarea 10).
- La App Link real y la fingerprint (tarea 05).
- Los emails de invitación (cuenta nueva/existente) y el de reset en los 9 idiomas completos; el
  mockup muestra el de reset como representante.
- Estados de carga de la web y errores de red del wizard en detalle; el estado de la app y el
  copy de error son la referencia.

## Cómo dar el visto bueno

1. Abre el HTML y recorre las cuatro superficies, claro y oscuro.
2. Cambia los estados; comprueba que el copy y las salidas tienen sentido.
3. Si algo no encaja, dime la superficie, el estado y qué cambiar; se itera en el HTML.
4. **P2:** cuando esté, dilo por escrito. Sin P2 no empieza la UI de 06, 07, 08 y 10.
