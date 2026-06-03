# Sprint 4: GitHub + Versionado + Deploy

> ⚠️ **Este sprint se trabaja en la rama `sprint/4-github-deploy`.** NO directamente en `main`.

## Contexto del proyecto

- **Stack:** Next.js 16.2.4 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS v4
- **DB:** Supabase (PostgreSQL + RLS). Sin ORM — cliente Supabase directo con tipos generados.
- **Auth:** Supabase Auth. Roles: `admin` / `member`.
- **Package manager:** pnpm
- **Hosting objetivo:** Vercel (web) + Supabase Cloud (producción)

---

## Objetivo del sprint

Convertir el proyecto en un repositorio GitHub con CI/CD, versionado semántico y deploy en producción. Prerequisito para:
- EAS Update de Expo (Sprint 4) — necesita CI/CD de GitHub Actions
- Usuarios reales — necesita Vercel + Supabase en producción
- Open-source — necesita README, CONTRIBUTING, licencia

---

## Decisiones de diseño a tomar al inicio del sprint

| Punto | Opciones | Bloqueante |
|---|---|---|
| Visibilidad del repo | Público / Privado | TASK-29 |
| Licencia | MIT / Apache 2.0 / AGPL | TASK-35 |
| Dominio personalizado | Usar .vercel.app o dominio propio | TASK-33 |
| Release automation | Manual / release-please / semantic-release | TASK-34 |

> El Capitán presenta estas decisiones al usuario antes de ejecutar las tareas dependientes.

---

## Tareas del sprint

---

### TASK-29 — GitHub repository setup

**Acciones:**
- Crear repositorio GitHub (visibilidad según decisión)
- Empujar código existente: `git remote add origin <url> && git push -u origin main`
- Verificar `.gitignore` completo: `.env`, `.env.local`, `node_modules/`, `.next/`, `supabase/.temp/`, `mobile/.expo/`
- Crear branch strategy documentation en `.github/CONTRIBUTING.md`:
  - `main` — producción, protegida
  - `feature/[desc]` — nuevas features
  - `fix/[desc]` — bug fixes
  - Commits en formato Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- Activar protección de rama `main`: PR requerida + CI verde + 1 approver

---

### TASK-30 — Versionado semántico de la plataforma

**Archivos:** `package.json` (raíz), `CHANGELOG.md`

- Establecer versión inicial en `package.json`: `"version": "0.1.0"` (pre-release, la 1.0.0 es para la primera versión estable)
- Crear `CHANGELOG.md` con formato [Keep a Changelog](https://keepachangelog.com):
  ```markdown
  # Changelog
  
  ## [Unreleased]
  
  ## [0.1.0] — 2026-05-10
  ### Added
  - Sistema de apps (Sprint 1): tipos, DB, installer, admin panel, todo app
  - Shell pública mobile-first (Sprint 2): header, bottom nav, dashboard
  - Permisos por app: visibility public/private, app_permissions
  - Sitio de documentación /doc con MDX
  ```
- Documentar en `apps/README.md` que `minPlatformVersion` en manifests referencia la versión del `package.json` raíz

---

### TASK-31 — GitHub Actions CI (tests + calidad)

**Archivo:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm tsc --noEmit
      - run: pnpm test --run
      - run: pnpm build
      - run: pnpm audit --audit-level moderate
```

- Badge de CI en README raíz (ver TASK-35)
- Asegurar que `pnpm test --run` no requiere DB real (mocks en tests unitarios)
- `pnpm audit` falla el CI si hay vulnerabilidades de severidad moderate o superior

---

### TASK-32 — Supabase en producción

**Pasos:**
1. Crear nuevo proyecto en [supabase.com](https://supabase.com) — nombre: `027apps-prod`
2. Aplicar todas las migraciones del repo al proyecto de producción:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
3. Guardar las variables de entorno de producción de forma segura (no en el repo):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — nunca exponer en cliente ni en `NEXT_PUBLIC_*`
4. Verificar RLS en producción con un usuario de prueba
5. **CORS:** En el dashboard de Supabase (`Authentication > URL Configuration > Allowed Origins`): añadir solo el dominio de producción. No usar `*`.
6. **Rate limits de Auth:** En el dashboard (`Authentication > Rate Limits`): revisar y ajustar límites para magic links, OTP y login (valores por defecto son razonables para grupos pequeños, verificar que estén activos).

> **Nota:** Las variables de entorno se añaden a Vercel en TASK-33, no al repo.

---

### TASK-33 — Deploy en Vercel + dominio

**Pasos:**
1. Conectar repo GitHub con Vercel (importar proyecto desde el dashboard de Vercel)
2. Configurar variables de entorno en Vercel (copiadas de TASK-32)
3. Deploy automático configurado: push a `main` → deploy a producción
4. Preview deploys en PRs: activado por defecto en Vercel
5. Si hay dominio propio: configurar en Vercel + DNS. Si no: usar `<proyecto>.vercel.app`
6. **Security headers** en `next.config.ts`:
   ```typescript
   async headers() {
     return [{
       source: '/(.*)',
       headers: [
         { key: 'X-Frame-Options', value: 'DENY' },
         { key: 'X-Content-Type-Options', value: 'nosniff' },
         { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
         { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
       ],
     }]
   }
   ```
7. Verificar que el deploy de producción funciona end-to-end (login, admin, apps)

---

### TASK-34 — CI/CD de releases automáticos

**Archivo:** `.github/workflows/release.yml`

Usar **release-please** de Google:
- Basado en Conventional Commits — detecta automáticamente el tipo de bumping (feat → minor, fix → patch, feat! → major)
- Crea PRs de release automáticamente con el CHANGELOG actualizado
- Al mergear el PR de release: crea el tag de versión y el GitHub Release

```yaml
name: Release
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
```

> Requiere que los commits sigan Conventional Commits (documentado en TASK-29).

---

### TASK-35 — README raíz del proyecto

**Archivo:** `README.md` en la raíz del repo

Contenido:
```markdown
# 027Apps

Open-source platform for group apps — for families, teams, or any collective.

[![CI](https://github.com/<org>/027apps/actions/workflows/ci.yml/badge.svg)](...)
[![Version](https://img.shields.io/github/v/release/<org>/027apps)](...)

## What is this?

[Descripción del proyecto y caso de uso]

## Stack

[Tabla de tecnologías]

## Getting started

### Requirements
- Node.js 22+
- pnpm
- Docker (for Supabase local)

### Installation
[Pasos de instalación local]

### Environment variables
[Lista de .env variables necesarias]

## Project structure
[Árbol de directorios clave]

## Creating apps
[Enlace a apps/README.md y al sitio /doc]

## Contributing
[Enlace a .github/CONTRIBUTING.md]

## License
[Licencia elegida en TASK-29]
```

---

## Orden de ejecución recomendado

```
TASK-29 (GitHub setup — PRIMER PASO)
    ↓
TASK-30 → TASK-31 → TASK-32 → TASK-33 → TASK-34 → TASK-35
(en orden: cada paso depende de que el repo esté en GitHub)
```

TASK-30 (versionado) puede hacerse en paralelo con TASK-31 (CI).
TASK-32 (Supabase prod) puede hacerse en paralelo con TASK-31 (CI).
TASK-33 (Vercel) requiere TASK-32 (variables de producción).
TASK-34 (releases) requiere TASK-29 (permisos en el repo).
TASK-35 (README) puede hacerse en paralelo con cualquier tarea.

---

## Notas para el agente implementador

1. **Conventional Commits es obligatorio desde TASK-29.** Todos los commits a partir de este sprint deben seguir el formato. El CI puede verificarlo con `commitlint`.

2. **Variables de entorno nunca en el repo.** `.env.local` debe estar en `.gitignore`. Documentar qué variables se necesitan en `README.md` y en un `.env.example` en el repo.

3. **Rama `main` protegida.** Una vez configurada la protección, incluso el owner necesita PR para mergear. Asegurarse de que CI está pasando antes de activar la protección.

4. **Supabase producción ≠ local.** Son dos proyectos distintos. Las migraciones deben aplicarse explícitamente con `supabase db push` al proyecto de producción. El proyecto local usa Docker.

5. **Preview deploys de Vercel** generan una URL única por PR — útil para QA. Configurar las variables de entorno de preview para que apunten a un entorno de staging si es necesario (o al mismo producción si no hay staging).

6. **release-please** requiere que el primer commit tras instalarlo sea un `feat:` o similar para generar el primer PR de release. Documentar esto en CONTRIBUTING.md.
