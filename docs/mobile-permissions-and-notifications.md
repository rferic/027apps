# Permisos y notificaciones push de la app mobile

## Permisos solicitados

| Permiso | Cuándo se pide | iOS | Android | Implementado |
|---|---|---|---|---|
| **Notificaciones push** | Al entrar a Settings → Notificaciones, o en el onboarding si se configura | System dialog (Allow/Deny) | Runtime permission | ✅ |
| **Biometría (Face ID / Huella)** | Al hacer login, botón "Sign in with biometrics" | System dialog (Face ID / Touch ID) | System dialog | ✅ |
| **SecureStore (llaves/credenciales)** | Al hacer login (automático, sin diálogo) | Keychain (sin prompt) | EncryptedSharedPreferences | ✅ |
| **Deep links** | Al abrir un enlace `027apps://` | Associated Domains | Intent filters | ✅ |
| **URL del servidor** | Onboarding (welcome screen) | No es permiso nativo | No es permiso nativo | ✅ |

### No solicitados aún (planificados)

| Permiso | Notas |
|---|---|
| **Cámara** | Para futuro escaneo de QR/códigos de invitación |
| **Galería/Fotos** | Para futuro avatar/subida de imágenes |
| **Ubicación** | No necesario por ahora |

## Notificaciones push

### Estado actual

El **backend NO envía notificaciones push**. La `POST /api/v1/mobile/push-token` solo registra el token Expo del dispositivo. Todas las notificaciones existentes son **por email** vía Resend.

La app mobile está lista para **recibir** notificaciones: tiene el handler configurado, el token registrado, y la navegación por deep link desde notificación.

### Notificaciones por email implementadas (convertibles a push)

#### Inspiration

| Evento | Disparador | Email to | Push planificado |
|---|---|---|---|
| Nueva idea creada | `POST /api/v1/:group/apps/inspiration` | Admins del grupo | Sí |
| Nuevo comentario | `POST /api/v1/:group/apps/inspiration/:id/comments` | Autor + votantes de la idea | Sí |
| Cambio de estado | `PUT /api/v1/:group/apps/inspiration/:id` | Autor + votantes de la idea | Sí |
| Cierre (completed/rejected/duplicate) | `PUT /api/v1/:group/apps/inspiration/:id` | Autor + votantes | Sí |

#### TODO

| Evento | Disparador | Email to | Push planificado |
|---|---|---|---|
| Tarea asignada | `PUT /api/v1/:group/apps/todo/:id` (asigna usuario) | Usuario asignado | Sí |
| Cambio de estado | `PUT /api/v1/:group/apps/todo/:id` (cambia status) | Usuario asignado | Sí |

### Lo que falta para tener push funcional

1. **Backend**: Crear un servicio que use `expo-server-sdk` para enviar push a través de Expo
2. **Integrar** en los `notify*` actuales: después del email, enviar también push a los tokens registrados
3. **Módulo de preferencias** en mobile: toggle para cada tipo de notificación (asignación, comentario, cambio de estado)

### Arquitectura propuesta para implementar push

```
Evento (nuevo TODO, comentario, etc.)
  → notifyPush(event, userIds)
    → query push_tokens WHERE user_id IN (userIds)
    → Expo.sendPushNotificationsAsync(messages)
    → cada mensaje: { to: token, title, body, data: { type, id, url } }
  → (en paralelo) notifyEmail(...) existente
```

La app mobile ya maneja el deep link desde notificación en `useNotifications.ts` línea 57-62:

```ts
if (data?.type === 'comment' && data?.requestId) {
  router.push(`/(app)/requests/${data.requestId}`)
}
```

Está mapeando a `/(app)/requests/` pero la ruta real es `/(app)/modules/inspiration/[id]`. Habría que corregirlo cuando se implemente push.
