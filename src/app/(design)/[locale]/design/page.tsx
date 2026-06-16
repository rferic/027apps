import Link from 'next/link'

const proposals = [
  {
    slug: 'propuesta-b',
    title: 'Pulso',
    subtitle: 'Editorial y Audaz',
    desc: 'Alto contraste, tipografía bold, composición tipo revista. Una identidad con presencia que transmite energía y confianza.',
    tags: ['Sans Bold', 'Contraste', 'Magazine', 'Impacto'],
    gradient: 'from-slate-50 to-red-50 dark:from-slate-950 dark:to-red-950/20',
    accent: 'bg-[#9B1C1C]',
  },
  {
    slug: 'propuesta-d',
    title: 'Clarity',
    subtitle: 'Corporativo y Preciso',
    desc: 'Limpieza visual y estructura clara. Tipografía Inter, bordes definidos, colores sobrios. Un enfoque serio y funcional.',
    tags: ['Inter', 'Estructura', 'SaaS', 'Funcional'],
    gradient: 'from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900',
    accent: 'bg-[#9B1C1C]',
  },
  {
    slug: 'propuesta-h',
    title: 'Modern',
    subtitle: 'Equilibrado y Contemporáneo',
    desc: 'Outfit + Sora, esquinas suaves y tarjetas de estadísticas. Un enfoque moderno que combina lo mejor de ambos mundos: serio pero acogedor.',
    tags: ['Outfit + Sora', 'Stats Cards', 'Suave', 'Moderno'],
    gradient: 'from-stone-50 to-slate-50 dark:from-stone-950 dark:to-slate-950',
    accent: 'bg-[#9B1C1C]',
  },
]

export default function DesignIndex() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Propuestas de diseño
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Tres direcciones profesionales para el rediseño de 027Apps.
            Compara y elige la que mejor represente la identidad de la familia.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {proposals.map((p) => (
            <Link
              key={p.slug}
              href={`/en/design/${p.slug}`}
              className="group block"
            >
              <div className={`rounded-2xl bg-gradient-to-b ${p.gradient} p-8 h-full border border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300`}>
                <div className={`w-10 h-10 rounded-xl ${p.accent} mb-6 flex items-center justify-center text-white font-bold text-sm`}>
                  {p.slug === 'propuesta-b' ? 'B' : p.slug === 'propuesta-d' ? 'D' : 'H'}
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-[#9B1C1C] transition-colors">
                  {p.title}
                </h2>
                <p className="text-sm font-medium text-[#9B1C1C] mb-4">{p.subtitle}</p>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  {p.desc}
                </p>

                <div className="flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
