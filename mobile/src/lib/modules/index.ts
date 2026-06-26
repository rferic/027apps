import { registerModule, type MobileModule } from './registry'

interface Manifest {
  slug: string
  name: string
  description: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  beta?: boolean
}

const manifests: Manifest[] = [
  {
    slug: 'todo',
    name: 'TODO',
    description: 'Task management',
    primaryColor: '#0EA5E9',
    beta: false,
  },
  {
    slug: 'inspiration',
    name: 'Inspiration',
    description: 'Capture and vote on ideas',
    primaryColor: '#8B5CF6',
    beta: false,
  },
]

const moduleCache = new Map<string, MobileModule>()

export function initModuleRegistry(): void {
  for (const m of manifests) {
    const cached = moduleCache.get(m.slug)
    if (cached) {
      registerModule(cached)
      continue
    }

    let View: MobileModule['View']

    try {
      const NativeView = require(`../../../../apps/${m.slug}/native`).default
      View = NativeView
    } catch {
      View = () => null
    }

    const mod: MobileModule = {
      slug: m.slug,
      name: m.name,
      description: m.description,
      icon: '📦',
      primaryColor: m.primaryColor ?? '#64748B',
      secondaryColor: m.secondaryColor ?? '#F1F5F9',
      beta: m.beta ?? false,
      View,
    }

    moduleCache.set(m.slug, mod)
    registerModule(mod)
  }
}
