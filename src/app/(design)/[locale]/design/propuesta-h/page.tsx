'use client'

import { useState } from 'react'
import Link from 'next/link'

const palettes = {
  light: {
    bg: '#F8F6F3', surface: '#FFFFFF', surface2: '#F0EDE8',
    primary: '#9B1C1C', 'primary-hover': '#841717', 'primary-soft': '#FDF2F2',
    secondary: '#1A232E', 'secondary-hover': '#0F151C',
    accent: '#9B1C1C', 'accent-hover': '#841717',
    text: '#171B22', 'text-secondary': '#6B7280',
    border: '#E2DDD6', muted: '#F0ECE6', glow: 'rgba(155, 28, 28, 0.08)',
  },
  dark: {
    bg: '#12120E', surface: '#1A1815', surface2: '#24221E',
    primary: '#D45050', 'primary-hover': '#E06464', 'primary-soft': '#2A1818',
    secondary: '#E2E0DA', 'secondary-hover': '#C8C4BC',
    accent: '#D45050', 'accent-hover': '#E06464',
    text: '#E2E0DA', 'text-secondary': '#8A867E',
    border: '#2A2824', muted: '#201E1A', glow: 'rgba(212, 80, 80, 0.1)',
  },
}

const APP_COLORS: Record<string, string> = {
  todo: '#4F46E5', inspiration: '#F59E0B', splitwise: '#10B981',
}

const tasks = [
  { title: 'Comprar leche y pan', priority: 'medium', category: 'Hogar', emoji: '🏠', due: 'Hoy', assignee: 'Eric', status: 'pending' },
  { title: 'Pedir cita pediatra', priority: 'high', category: 'Nico', emoji: '👶', due: 'Mañana', assignee: 'Eric', status: 'pending' },
  { title: 'Pagar factura luz', priority: 'urgent', category: 'Finanzas', emoji: '💰', due: 'Viernes', assignee: 'María', status: 'pending' },
]

const ideas = [
  { title: 'App para recetas de cocina', type: 'new_app', votes: 12, comments: 5 },
  { title: 'Recordatorio de riego plantas', type: 'improvement', votes: 8, comments: 3 },
]

const pColors: Record<string, string> = { urgent: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#6B7280' }

export default function PropuestaH() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')
  const [userOpen, setUserOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [modal, setModal] = useState<'new-task' | null>(null)
  const [detailTask, setDetailTask] = useState<string | null>(null)
  const t = theme
  const p = palettes[t]
  const detailTaskData = tasks.find(t => t.title === detailTask)

  return (
    <div className={t} style={{ background: p.bg, color: p.text, fontFamily: '"Sora", system-ui, sans-serif', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Sora:wght@300;400;500;600;700&display=swap');
        .hh { font-family: "Outfit", sans-serif; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
        .h-btn { transition: all 0.2s; cursor: pointer; border: none; font-weight: 600; }
        .h-btn:active { transform: scale(0.97); }
        .h-card { transition: all 0.25s; }
        .h-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
        .h-input { outline: none; transition: all 0.15s; }
        .h-input:focus { box-shadow: 0 0 0 2px ${p.primary}30; }
      `}</style>

      <div style={{ margin: '0 auto', maxWidth: view === 'mobile' ? 375 : 1280, transition: 'max-width 0.3s' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '14px 24px 0' }}>
          {['B', 'D', 'H'].map((l) => (
            <Link key={l} href={`/en/design/propuesta-${l.toLowerCase()}`}
              style={{
                padding: '6px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: l === 'H' ? p.primary : 'transparent',
                color: l === 'H' ? 'white' : p['text-secondary'],
                border: `1px solid ${l === 'H' ? p.primary : p.border}`,
                textDecoration: 'none', fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.01em',
              }}
            >{l === 'B' ? 'B · Pulso' : l === 'D' ? 'D · Clarity' : 'H · Modern'}</Link>
          ))}
          <div style={{ flex: 1 }} />
          {(['desktop', 'mobile'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className="h-btn"
              style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontFamily: '"Sora", sans-serif',
                background: view === v ? p.surface : 'transparent',
                color: view === v ? p.text : p['text-secondary'],
                border: view === v ? `1px solid ${p.border}` : 'none',
              }}
            >{v === 'desktop' ? 'Desktop' : 'Mobile'}</button>
          ))}
          <button onClick={toggleTheme} className="h-btn"
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, border: `1px solid ${p.border}`, background: 'transparent', color: p['text-secondary'], fontFamily: '"Sora", sans-serif' }}
          >{theme === 'light' ? '☾' : '☀'}</button>
        </div>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', marginTop: 8, background: p.surface, borderRadius: 12, border: `1px solid ${p.border}` }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,12 8,12 10,18 14,6 16,12 20,12"/></svg>
              </div>
              <span className="hh" style={{ fontSize: 15, color: p.text, display: view === 'mobile' ? 'none' : 'inline' }}>027Apps</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div onClick={() => { setGroupOpen(!groupOpen); setUserOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', background: p.muted, fontSize: 12, fontWeight: 600, color: p['text-secondary'] }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white' }}>F</span>
                Familia
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6,9 12,15 18,9"/></svg>
              </div>
              {groupOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 190, background: p.surface, borderRadius: 12, border: `1px solid ${p.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', padding: 6, zIndex: 100 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: p['text-secondary'], textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 8px', margin: 0 }}>Grupos</p>
                  {[{ name: 'Familia', isAdmin: false }, { name: 'Trabajo', isAdmin: true }].map((g) => (
                    <div key={g.name} onClick={() => setGroupOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', background: g.name === 'Familia' ? p.muted : 'transparent', fontSize: 13, fontWeight: 500, color: p.text }}>
                      <span style={{ width: 24, height: 24, borderRadius: 6, background: g.isAdmin ? p.primary : p.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: g.isAdmin ? 'white' : p['text-secondary'] }}>{g.name[0]}</span>
                      <span style={{ flex: 1 }}>{g.name}</span>
                      {g.name === 'Familia' && <span style={{ fontSize: 12, color: p.primary }}>✓</span>}
                      {g.isAdmin && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: p.primary + '12', color: p.primary }}>admin</span>}
                    </div>
                  ))}
                </div>
              )}
              {groupOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setGroupOpen(false)} />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <div style={{ position: 'relative' }}>
              <div onClick={() => { setUserOpen(!userOpen); setGroupOpen(false) }}
                style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${p.secondary}, ${p.text})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>ER</div>
              {userOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 175, background: p.surface, borderRadius: 12, border: `1px solid ${p.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', padding: 6, zIndex: 100 }}>
                  {[{ label: 'Editar perfil', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }, { label: 'Backoffice', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6' }].map(item => (
                    <div key={item.label} onClick={() => setUserOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: p.text }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                      {item.label}
                    </div>
                  ))}
                  <div style={{ height: 1, background: p.border, margin: '4px 0' }} />
                  <div onClick={() => setUserOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: p.text }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    Cerrar sesión
                  </div>
                </div>
              )}
              {userOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setUserOpen(false)} />}
            </div>
          </div>
        </header>

        {/* Subnav */}
        <div style={{ display: view === 'mobile' ? 'none' : 'flex', gap: 2, padding: '8px 0', marginTop: 4 }}>
          {['Inicio', 'Todo', 'Inspiración', 'Splitwise'].map((item, i) => (
            <span key={item} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: i === 0 ? 700 : 500,
              background: i === 0 ? p.surface : 'transparent',
              color: i === 0 ? p.primary : p['text-secondary'],
              border: i === 0 ? `1px solid ${p.border}` : 'none',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{item}</span>
          ))}
        </div>

        {/* Dashboard */}
        <div style={{ padding: view === 'mobile' ? '0 0 80px' : '20px 0 80px' }}>
          {/* Welcome */}
          <div style={{ marginBottom: 28 }}>
            <h1 className="hh" style={{ fontSize: 28, color: p.text, margin: 0 }}>Panel</h1>
            <p style={{ fontSize: 13, color: p['text-secondary'], margin: '4px 0 0' }}>Buenos días, Eric — tenéis 3 tareas para hoy.</p>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 28 }}>
            {/* Bar chart: Tareas completadas por día */}
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <p className="hh" style={{ fontSize: 15, color: p.text, margin: 0 }}>Tareas completadas</p>
                  <p style={{ fontSize: 12, color: p['text-secondary'], margin: '2px 0 0' }}>Esta semana</p>
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: p.primary }}>12</span>
              </div>
              <svg width="100%" height="100" viewBox="0 0 300 100" style={{ display: 'block' }}>
                {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
                  <g key={i}>
                    <rect x={10 + i * 40} y={95 - h * 0.85} width="24" height={h * 0.85} rx="4" fill={i === 5 ? p.primary : p.border} opacity={i === 5 ? 1 : 0.4} />
                    <text x={10 + i * 40 + 12} y="98" textAnchor="middle" fontSize="8" fill={p['text-secondary']}>
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}
                    </text>
                    <text x={10 + i * 40 + 12} y={95 - h * 0.85 - 4} textAnchor="middle" fontSize="8" fill={i === 5 ? p.primary : p['text-secondary']} fontWeight={i === 5 ? 700 : 400}>
                      {h}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Donut chart: Estado de tareas */}
            <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
              <p className="hh" style={{ fontSize: 15, color: p.text, margin: '0 0 12px' }}>Estado general</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke={p.border} strokeWidth="16" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#4ADE80" strokeWidth="16" strokeDasharray={`${75 * 2.51} ${25 * 2.51}`} strokeDashoffset="25.1" transform="rotate(-90 50 50)" strokeLinecap="round" />
                  <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="700" fill={p.text}>75%</text>
                  <text x="50" y="62" textAnchor="middle" fontSize="8" fill={p['text-secondary']}>hecho</text>
                </svg>
                <div style={{ flex: 1 }}>
                  {[
                    { label: 'Completadas', value: '9', color: '#4ADE80' },
                    { label: 'Pendientes', value: '3', color: p.primary },
                    { label: 'Vencidas', value: '1', color: '#EF4444' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                      <span style={{ fontSize: 12, color: p['text-secondary'], flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Tareas hoy', value: '3', color: APP_COLORS.todo },
              { label: 'Ideas activas', value: '8', color: APP_COLORS.inspiration },
              { label: 'Gastos mes', value: '€234', color: APP_COLORS.splitwise },
              { label: 'Miembros', value: '5', color: p.primary },
            ].map((stat) => (
              <div key={stat.label} style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: p['text-secondary'], margin: '0 0 4px' }}>{stat.label}</p>
                <p className="hh" style={{ fontSize: 22, color: stat.color, margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Your Apps */}
          <section style={{ marginBottom: 28 }}>
            <h2 className="hh" style={{ fontSize: 17, color: p.text, margin: '0 0 14px' }}>Aplicaciones</h2>
            <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { slug: 'todo', name: 'Todo', desc: 'Tareas compartidas de la familia', stat: '12 tareas', color: APP_COLORS.todo },
                { slug: 'inspiration', name: 'Inspiración', desc: 'Banco de ideas y votaciones', stat: '8 activas', color: APP_COLORS.inspiration },
                { slug: 'splitwise', name: 'Splitwise', desc: 'Control de gastos compartidos', stat: '€234 este mes', color: APP_COLORS.splitwise },
              ].map((app) => (
                <div key={app.slug} className="h-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 18, cursor: 'pointer' }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${app.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                      {app.slug === 'todo' ? '✓' : app.slug === 'inspiration' ? '💡' : '€'}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: p.text, margin: 0 }}>{app.name}</p>
                      <p style={{ fontSize: 11, color: p.primary, margin: 0, fontWeight: 600 }}>{app.stat}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: p['text-secondary'], lineHeight: 1.5, margin: 0 }}>{app.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Todo Widget */}
            <div className="h-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-2">
                  <span className="hh" style={{ fontSize: 15, color: p.text }}>Todo</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 10px', borderRadius: 6, background: p.muted, color: p['text-secondary'] }}>Hoy</span>
                </div>
                <button onClick={() => setModal('new-task')} className="h-btn"
                  style={{ background: p.primary, color: 'white', padding: '6px 16px', fontSize: 12, borderRadius: 8, fontFamily: '"Sora", sans-serif' }}>+ Nueva</button>
              </div>
              {tasks.map((task, i) => (
                <div key={i} onClick={() => setDetailTask(task.title)}
                  style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < tasks.length - 1 ? `1px solid ${p.border}` : 'none', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 8, border: `2px solid ${p.border}`, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{task.title}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${pColors[task.priority]}15`, color: pColors[task.priority] }}>{task.priority}</span>
                      <span style={{ fontSize: 11, color: p['text-secondary'] }}>{task.emoji} {task.category}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: task.due === 'Hoy' ? p.primary : p['text-secondary'] }}>{task.due === 'Hoy' ? '⚠ Hoy' : task.due}</span>
                    </div>
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: p.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: p['text-secondary'], flexShrink: 0 }}>{task.assignee[0]}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.primary, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>

            {/* Inspiration Widget */}
            <div className="h-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-2">
                  <span className="hh" style={{ fontSize: 15, color: p.text }}>Inspiración</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 10px', borderRadius: 6, background: p.primary + '12', color: p.primary }}>{ideas.reduce((s, i) => s + i.votes, 0)} votos</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ideas.map((idea, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < ideas.length - 1 ? `1px solid ${p.border}` : 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: p.muted, color: p['text-secondary'] }}>{idea.type === 'new_app' ? 'Nueva app' : 'Mejora'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{idea.title}</p>
                      <p style={{ fontSize: 11, color: p['text-secondary'], margin: '2px 0 0' }}>♥ {idea.votes} · 💬 {idea.comments}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', fontSize: 12, color: p['text-secondary'] }}>
                <span>✅</span> Migrar fotos a la nube <span style={{ color: p['text-secondary'] }}>— hace 3 días</span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.primary, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        {view === 'mobile' && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: p.surface, borderTop: `1px solid ${p.border}`, padding: '8px 16px', display: 'flex', justifyContent: 'space-around' }}>
            {['Inicio', 'Todo', 'Ideas', 'Gastos', '⋯'].map((l, i) => (
              <div key={i} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? p.primary : p['text-secondary'], cursor: 'pointer' }}>{l}</div>
            ))}
          </div>
        )}

        <footer style={{ textAlign: 'center', padding: '20px', borderTop: `1px solid ${p.border}`, color: p['text-secondary'], fontSize: 11 }}>
          Propuesta &ldquo;Modern&rdquo; — 027Apps
        </footer>

        {/* New Task Modal */}
        {modal === 'new-task' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setModal(null)} />
            <div style={{ position: 'relative', background: p.surface, borderRadius: 16, width: '90%', maxWidth: 480, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <h3 className="hh" style={{ fontSize: 18, color: p.text, margin: 0 }}>Nueva tarea</h3>
                <button onClick={() => setModal(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: p.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input className="h-input" placeholder="Título de la tarea" style={{ background: p.muted, border: `1.5px solid ${p.border}`, color: p.text, padding: '11px 14px', fontSize: 14, width: '100%', borderRadius: 10 }} />
                <textarea className="h-input" placeholder="Descripción (opcional)" rows={3} style={{ background: p.muted, border: `1.5px solid ${p.border}`, color: p.text, padding: '11px 14px', fontSize: 14, width: '100%', borderRadius: 10, resize: 'none' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select className="h-input" style={{ background: p.muted, border: `1.5px solid ${p.border}`, color: p.text, padding: '11px 14px', fontSize: 13, borderRadius: 10, appearance: 'none' }}>
                    <option>Categoría</option><option>🏠 Hogar</option><option>👶 Nico</option><option>💰 Finanzas</option>
                  </select>
                  <select className="h-input" style={{ background: p.muted, border: `1.5px solid ${p.border}`, color: p.text, padding: '11px 14px', fontSize: 13, borderRadius: 10, appearance: 'none' }}>
                    <option>Prioridad</option><option>🔴 Urgente</option><option>🟠 Alta</option><option>🟡 Media</option><option>⚪ Baja</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="date" className="h-input" style={{ background: p.muted, border: `1.5px solid ${p.border}`, color: p.text, padding: '11px 14px', fontSize: 13, borderRadius: 10, flex: 1 }} />
                  <label style={{ fontSize: 12, color: p['text-secondary'], display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" style={{ accentColor: p.primary }} /> Sin fecha
                  </label>
                </div>
                <button className="h-btn" style={{ background: p.primary, color: 'white', padding: '13px', fontSize: 14, borderRadius: 10, fontFamily: '"Sora", sans-serif', marginTop: 4 }}>Crear tarea</button>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail */}
        {detailTask && detailTaskData && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDetailTask(null)} />
            <div style={{ position: 'relative', background: p.surface, borderRadius: 16, width: '90%', maxWidth: 380, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3 className="hh" style={{ fontSize: 17, color: p.text, margin: 0 }}>{detailTaskData.title}</h3>
                <button onClick={() => setDetailTask(null)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: p.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 6, background: `${pColors[detailTaskData.priority]}15`, color: pColors[detailTaskData.priority] }}>{detailTaskData.priority}</span>
                <span style={{ fontSize: 11, color: p['text-secondary'] }}>{detailTaskData.emoji} {detailTaskData.category}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: detailTaskData.due === 'Hoy' ? p.primary : p['text-secondary'] }}>{detailTaskData.due === 'Hoy' ? '⚠ Vence hoy' : `Vence: ${detailTaskData.due}`}</span>
              </div>
              <p style={{ fontSize: 13, color: p['text-secondary'], lineHeight: 1.6, marginBottom: 20 }}>Asignada a <strong style={{ color: p.text }}>{detailTaskData.assignee}</strong>.</p>
              <div className="flex gap-2">
                <button className="h-btn" style={{ background: p.primary, color: 'white', padding: '10px 22px', fontSize: 13, borderRadius: 8, fontFamily: '"Sora", sans-serif' }}>Marcar hecha</button>
                <button className="h-btn" style={{ background: 'transparent', color: p.text, border: `1.5px solid ${p.border}`, padding: '10px 22px', fontSize: 13, borderRadius: 8, fontFamily: '"Sora", sans-serif' }}>Editar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
