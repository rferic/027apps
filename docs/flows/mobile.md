# Flujo — app móvil (Android e iOS)

Cómo evoluciona una app sin que la otra se quede atrás. La arquitectura y las decisiones están en la
[spec de la app iOS](../superpowers/specs/2026-11-21-ios-app.md); la matriz de capacidades, en
[`docs/ai/parity.md`](../ai/parity.md).

Hoy solo existe Android. Este flujo se activa en el momento en que arranca iOS (§12 de la spec), pero
la regla 1 ya aplica desde ahora.

## Reglas

1. **El comportamiento vive en `spec/mobile/`, no en la app.** Una regla, validación, texto o estado
   nuevo nace con su escenario en `spec/mobile/` en el mismo PR que lo implementa. Sin escenario no
   es contrato.
2. **Lo que el servidor puede calcular, lo calcula el servidor.** Antes de añadir lógica a la app,
   preguntar si pertenece al Core. Una regla en el Core es una sola implementación.
3. **La UI es nativa y no se comparte.** Compose en Android, SwiftUI en iOS. Copiar el layout de una
   plataforma a otra no es un objetivo; las decisiones de jerarquía sí.
4. **Una divergencia se declara, no se esconde.** Toda diferencia de plataforma va a la tabla de
   divergencias de la spec y a `docs/ai/parity.md` con su motivo.
5. **El baseline se congela.** La paridad se mide contra el commit etiquetado al arrancar iOS, no
   contra un "todo lo que hay en main".

## Propagación de un cambio

```
Cambio en Android
   ├─ ¿Es regla de negocio?          → Core (/api/v1). iOS no toca nada.
   ├─ ¿Cambia comportamiento?        → spec/mobile/ (escenario/fixture) + Android.
   │                                   El job `ios` queda rojo hasta que Swift cumple.
   └─ ¿Es capacidad nueva?           → fila en docs/ai/parity.md con dueño y sprint.
```

Comandos:

```bash
pnpm check:parity          # ya existe: valida la matriz y que cada escenario pertenece a una capacidad
pnpm gen:mobile            # fase 1: DTOs, textos y tokens desde su único origen
pnpm gen:mobile --check    # fase 1: falla si lo generado está desactualizado
pnpm spec:test:android     # fase 1: escenarios de spec/mobile/ con Kotlin
```

`spec/mobile/` y `pnpm check:parity` existen desde ya: el comportamiento se documenta ahí aunque
iOS todavía no esté. La regla de divergencia se relaja mientras la matriz declare
`## Baseline iOS pendiente`, y pasa a estricta al borrar esa sección.

En CI eso son tres gates: `android`, `ios` y `guard-secrets` (que ya incluye
`check:destructive-db`). Un PR del sprint no se mergea sin los tres verdes.

## Verificación de la app iOS

No hay revisión humana del código Swift. Se sustituye por una puerta automática y tres humanas.

### G0 — automática (cada push)

- `xcodebuild test`: unit + escenarios de `spec/mobile/`.
- XCUITest de humo: arranque → login → home → crear gasto → ver saldo.
- `pnpm gen:mobile --check` y `pnpm check:parity`.
- Auditoría de seguridad iOS (checklist de la spec §7), agente distinto del autor.

### G1 — patrón (una vez, 30–40 min del propietario)

Se prueba con las 2–3 primeras pantallas, antes de fan-out del resto:

- [ ] Tipografía y jerarquía se leen bien en un móvil real o simulador a tamaño real.
- [ ] Navegación: retroceso, gestos, dónde queda el contexto.
- [ ] Hojas y diálogos: cuándo cada uno, y que se sienten del sistema.
- [ ] Densidad y espaciado: ni apretado ni vacío frente a Android.
- [ ] Color y modo oscuro: mismos tokens, contraste correcto.
- [ ] Sensación general: "parece una app de iPhone".

Si algo de esto falla, se corrige **antes** de generar las pantallas restantes.

### G2 — integraciones (tercero con iPhone, checklist de 10 puntos)

- [ ] Primer arranque: se abre contra la instancia por defecto y deja cambiarla.
- [ ] Login y cierre de sesión; la sesión sobrevive a cerrar la app.
- [ ] Reinstalar: la sesión **no** sobrevive (Keychain limpio) y no queda token en claro.
- [ ] Push de gasto: llega, con importe visible y con importe oculto según el ojo.
- [ ] Push de invitación: texto localizado en el idioma del móvil.
- [ ] Enlace de invitación desde Safari/Mail: abre la app en la pantalla correcta.
- [ ] QR de invitación: se genera y se lee con otro móvil.
- [ ] QR de traspaso entre móviles: completa el cambio de dispositivo.
- [ ] Widget en pantalla de inicio: muestra el saldo y se actualiza tras un gasto.
- [ ] Instancia propia en `http://192.168.x.x` (solo build interna): conecta.

### G3 — frontal (propietario, 2–3 h, al final)

Pasada completa sobre la app estable, con la lista de `docs/ai/parity.md` al lado:

- [ ] Las 10 pantallas se abren y muestran datos reales.
- [ ] Estados vacío, error y carga en cada una.
- [ ] Crear, editar y borrar un gasto; reparto igual y exacto.
- [ ] Importes con coma/punto y moneda del perfil.
- [ ] El ojo oculta importes en todas las pantallas, incluido el widget.
- [ ] Importación de CSV: mapeo, previsualización y confirmación.
- [ ] Invitación: cuota, QR, enlace, solicitud al administrador.
- [ ] Lista de solicitudes (administrador) y decisión.
- [ ] Ajustes: instancia, idioma, privacidad, changelog.
- [ ] Los 9 idiomas cambian sin reiniciar y sin textos sin traducir.
- [ ] Modo oscuro en todas las pantallas.
- [ ] Texto grande (Dynamic Type) sin cortes.
- [ ] Sin animaciones rotas ni parpadeos en la navegación.
- [ ] La versión y el aviso de actualización se muestran correctamente.
- [ ] Nada de la app se queda en blanco al volver del segundo plano.

Un fallo de G2 o G3 se convierte en escenario de `spec/mobile/` o en un check, no en una nota mental.

## Release

1. Tag de versión → APK firmado al GitHub Release (como hoy) y subida a TestFlight.
2. TestFlight interno: caduca a los 90 días; el pipeline re-sube sin intervención.
3. Tras la primera entrega: cada release móvil sube `versionCode`/`versionName` (Android) y
   `CFBundleShortVersionString`/`CFBundleVersion` (iOS), y añade su entrada al changelog de ambas.
4. La promoción a producción sigue [git](git.md): `staging` → `main` con aprobación explícita.

## Lo que este flujo no promete

- Que nadie pruebe la app: alguien la prueba en G2 y G3. Lo que se evita es que sea el propietario
  en cada iteración.
- Que la app iOS se vea igual que Android: se ve como una app de iPhone con las mismas capacidades.
- Que la paridad visual sea automática: es revisión humana (G1, G3), no check.
