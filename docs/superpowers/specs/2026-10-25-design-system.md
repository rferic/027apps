# Spec — Design System v1 (sprint 02, task 02)

**Fecha:** 2026-10-25
**Estado:** Borrador para aprobación del usuario
**Base:** Identidad D (`docs/brand/identities/d.md`, ADR 0002) · Mockup: `docs/brand/mockups/ds.html`
**Referencias:** OpenRouter (web), Orca/Onorca (estética), Splitwise (app)

## 1. Objetivo

Formalizar los componentes y patrones de UI (v1) en base a la identidad D. El sistema debe ser **técnico y denso en la web admin** (estilo OpenRouter) y **cálido y táctil en la app móvil** (estilo Splitwise), ambos unificados por los tokens existentes.

## 2. Filosofía (Lecciones de referencias)

| Referencia | Principio adoptado | Aplicación en 027Apps |
|---|---|---|
| **OpenRouter** | Densidad de datos, alto contraste, datos sobre decoración | Admin web: tablas compactas, métricas en mono, sidebar fija. |
| **Orca (Onorca)** | Minimalismo elegante, dark mode "true black", espacio en blanco controlado | Base de estilo compartida, radios moderados (8/12px), sin bordes gruesos. |
| **Splitwise** | UX móvil primero, tarjetas táctiles, color semántico simple | App Android: Cards grandes, feedback inmediato, colores de estado claros (verde/rojo). |

## 3. Alcance (Componentes v1)

### Web Admin (Next.js)
1.  **Layout Shell**: Sidebar (nav-item con estado activo sólido `--primary`) + Topbar.
2.  **Data Table**: Cabecera en `muted-foreground` (mayúsculas 11px), filas con border-bottom hairline, números alineados a la derecha en `--font-mono`.
3.  **KPI Card**: Fondo `--surface` sobre `--background`, etiqueta en 11px uppercase, valor en mono 18px.
4.  **Botones**: `primary` (sólido), `secondary` (borde muted), `ghost`, `destructive`.
5.  **Badges**: Píldoras de estado (verde/rojo/gray) con fondos translúcidos del color al 12%.

### App Android (Compose)
1.  **Card Container**: Superficie elevada suave (sin bordes duros).
2.  **Balance Row**: Layout de flex: Avatar + Nombre + Píldora semántica (debe/tiene).
3.  **Pill/Badge móvil**: Fondos al 10% con texto de color sólido (segregación de tonos).

## 4. Reglas de Estilo (Anti-objetivo: la memoria)

- **Regla de tokens**: Nada de colores hardcodeados. Solo variables (`--primary`, `--accent`).
- **Regla tipográfica**: `Inter` para UI general. `JetBrains Mono` *solo* para datos numéricos/variables (balances, IDs, JSON).
- **Regla de densidad**: Admin minimiza el padding (8/12px). Móvil maximiza el padding (16/20px) para el tacto.

## 4bis. Acentos de módulo (delta 2026-10-27, task-03)

Los módulos aportan su acento propio sin romper la coherencia (anti-objetivo: "módulos estéticamente dispares"): el manifest declara **`branding.color` ∈ 8 slots** y **nunca hex libre**. Cada slot define `--module-accent` y su tinte en claro/oscuro (derivado del teal de identidad D como base):

| Slot | Claro | Oscuro |
|---|---|---|
| `teal` (identidad D) | `#09795F` | `#1CC29F` |
| `emerald` | `#047857` | `#34D399` |
| `sky` | `#0369A1` | `#38BDF8` |
| `indigo` | `#4F46E5` | `#818CF8` |
| `violet` | `#7C3AED` | `#A78BFA` |
| `amber` | `#B45309` | `#FBBF24` |
| `rose` | `#BE123C` | `#FB7185` |
| `slate` | `#475569` | `#94A3B8` |

Reglas: un módulo = **un** slot; el slot se aplica como `--module-accent` en su UI (badges, iconos, KPIs), **no** a botones primarios (el `--primary` del sistema manda); el contraste AA se verifica en ambos modos; el icono del módulo se renderiza con `currentColor`.

## 5. Criterios de aceptación (Para cuando se implemente)

- El mockup HTML debe ser replicable en el código real con 1:1 fidelidad de tokens.
- Storybook (o preview en el futuro) debe listar estos componentes como base.
- La accesibilidad (AA) del contraste de badges y botones debe ser validada.

## 5bis. Contrato de los componentes base (de la auditoría de seguridad, sprint 02)

- **`href` de `NavItem`/enlaces**: solo rutas relativas o absolutas `http(s)`. Nunca `javascript:`/`data:` ni valores derivados de input de usuario sin validar el esquema en el punto donde se construyan desde datos dinámicos. En v1 son constantes; al cablear navegación real se valida en la capa de datos.
- **`children` de Button/Badge**: texto o `ReactNode` confiado (React lo escapa). No inyectar HTML crudo ni `dangerouslySetInnerHTML` en estos primitives.
