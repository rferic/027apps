'use client'

import { useState } from 'react'
import Link from 'next/link'

const palettes = {
  light: {
    bg: '#F8FAFC', surface: '#FFFFFF', surface2: '#F1F5F9',
    primary: '#9B1C1C', 'primary-hover': '#841717', 'primary-soft': '#FEF2F2',
    secondary: '#0F172A', 'secondary-hover': '#1E293B',
    accent: '#475569', 'accent-hover': '#334155',
    text: '#0F172A', 'text-secondary': '#64748B',
    border: '#E2E8F0', muted: '#F1F5F9', glow: 'rgba(15, 23, 42, 0.06)',
  },
  dark: {
    bg: '#0B1120', surface: '#131A2B', surface2: '#1A2338',
    primary: '#E04848', 'primary-hover': '#EC5C5C', 'primary-soft': '#2A1414',
    secondary: '#F1F5F9', 'secondary-hover': '#CBD5E1',
    accent: '#94A3B8', 'accent-hover': '#CBD5E1',
    text: '#F1F5F9', 'text-secondary': '#94A3B8',
    border: '#1E293B', muted: '#1A2338', glow: 'rgba(224, 72, 72, 0.1)',
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

const pColors: Record<string, string> = { urgent: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#64748B' }

export default function PropuestaD() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')
  const [userOpen, setUserOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [modal, setModal] = useState<'new-task' | null>(null)
  const [detailTask, setDetailTask] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState('Familia')
  const t = theme
  const p = palettes[t]
  const detailTaskData = tasks.find(t => t.title === detailTask)

  return (
    <div className={t} style={{ background: p.bg, color: p.text, fontFamily: '"Inter", system-ui, sans-serif', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap');
        .dh { font-weight: 700; letter-spacing: -0.025em; line-height: 1.15; }
        .d-btn { font-weight: 600; transition: all 0.15s; cursor: pointer; border: none; }
        .d-btn:active { transform: scale(0.97); }
        .d-card { transition: all 0.2s; }
        .d-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .d-input { outline: none; transition: all 0.15s; }
        .d-input:focus { box-shadow: 0 0 0 2px ${p.primary}40; }
      `}</style>

      <div style={{ margin: '0 auto', maxWidth: view === 'mobile' ? 375 : 1280, transition: 'max-width 0.3s' }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '12px 24px 0' }}>
          {['B', 'D', 'H'].map((l) => (
            <Link key={l} href={`/en/design/propuesta-${l.toLowerCase()}`}
              style={{
                padding: '5px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: l === 'D' ? p.primary : 'transparent',
                color: l === 'D' ? 'white' : p['text-secondary'],
                border: `1px solid ${l === 'D' ? p.primary : p.border}`,
                textDecoration: 'none',
              }}
            >Propuesta {l}</Link>
          ))}
          <div style={{ flex: 1 }} />
          {(['desktop', 'mobile'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className="d-btn"
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: view === v ? p.surface : 'transparent',
                color: view === v ? p.text : p['text-secondary'],
                border: view === v ? `1px solid ${p.border}` : 'none',
              }}
            >{v === 'desktop' ? 'Desktop' : 'Mobile'}</button>
          ))}
          <button onClick={toggleTheme} className="d-btn"
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, border: `1px solid ${p.border}`, background: 'transparent', color: p['text-secondary'] }}
          >{theme === 'light' ? '🌙' : '☀️'}</button>
        </div>

        {/* Nav propuestas info */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '4px 24px 0' }}>
          <span style={{ fontSize: 11, color: p['text-secondary'], fontStyle: 'italic' }}>Comparativa profesional — propuesta seleccionada: D</span>
        </div>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderBottom: `1px solid ${p.border}`, background: p.surface, marginTop: 8 }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,12 8,12 10,18 14,6 16,12 20,12"/></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: p.text, display: view === 'mobile' ? 'none' : 'inline' }}>027Apps</span>
            </div>
            <div style={{ position: 'relative' }}>
              <div onClick={() => { setGroupOpen(!groupOpen); setUserOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: p['text-secondary'] }}>
                {selectedGroup}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
              </div>
              {groupOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 180, background: p.surface, borderRadius: 8, border: `1px solid ${p.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 4, zIndex: 100 }}>
                  {['Familia', 'Trabajo'].map(g => (
                    <div key={g} onClick={() => { setSelectedGroup(g); setGroupOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 4, cursor: 'pointer', background: selectedGroup === g ? p.muted : 'transparent', fontSize: 13, fontWeight: selectedGroup === g ? 600 : 400, color: p.text }}>
                      {g}
                      {selectedGroup === g && <span style={{ marginLeft: 'auto', fontSize: 12, color: p.primary }}>✓</span>}
                      {g === 'Trabajo' && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: p.primary + '15', color: p.primary }}>ADMIN</span>}
                    </div>
                  ))}
                </div>
              )}
              {groupOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setGroupOpen(false)} />}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ position: 'relative' }}>
              <div onClick={() => { setUserOpen(!userOpen); setGroupOpen(false) }}
                style={{ width: 30, height: 30, borderRadius: 6, background: p.text, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.bg, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>ER</div>
              {userOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 170, background: p.surface, borderRadius: 8, border: `1px solid ${p.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 4, zIndex: 100 }}>
                  {[{ label: 'Editar perfil', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' }, { label: 'Backoffice', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6' }].map(item => (
                    <div key={item.label} onClick={() => setUserOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: p.text }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                      {item.label}
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${p.border}`, margin: '4px 0' }} />
                  <div onClick={() => setUserOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: p.text }}>
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
        <div style={{ display: view === 'mobile' ? 'none' : 'flex', gap: 0, padding: '0 24px', background: p.surface, borderBottom: `1px solid ${p.border}` }}>
          {['Home', 'Todo', 'Inspiración', 'Splitwise'].map((item, i) => (
            <span key={item} style={{
              padding: '10px 20px', fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? p.primary : p['text-secondary'],
              borderBottom: i === 0 ? `2px solid ${p.primary}` : '2px solid transparent', cursor: 'pointer',
            }}>{item}</span>
          ))}
        </div>

        {/* Dashboard */}
        <div style={{ padding: view === 'mobile' ? '0 16px 80px' : '24px 24px 80px' }}>
          {/* Section title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 className="dh" style={{ fontSize: 20, color: p.text, margin: 0 }}>Dashboard</h2>
            <span style={{ fontSize: 12, color: p['text-secondary'] }}>{tasks.length} tareas pendientes</span>
          </div>

          {/* Your Apps */}
          <section style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: p['text-secondary'], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Aplicaciones</p>
            <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { slug: 'todo', name: 'Todo', desc: 'Gestión de tareas familiares', stat: '12 tareas', color: APP_COLORS.todo },
                { slug: 'inspiration', name: 'Inspiración', desc: 'Banco de ideas', stat: '8 activas', color: APP_COLORS.inspiration },
                { slug: 'splitwise', name: 'Splitwise', desc: 'Control de gastos compartidos', stat: '€234/mes', color: APP_COLORS.splitwise },
              ].map((app) => (
                <div key={app.slug} className="d-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, padding: 16, cursor: 'pointer' }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: `${app.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: app.color, fontWeight: 700, fontSize: 16 }}>
                      {app.slug === 'todo' ? '✓' : app.slug === 'inspiration' ? '💡' : '€'}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: p.text, margin: 0 }}>{app.name}</p>
                      <p style={{ fontSize: 11, color: p['text-secondary'], margin: 0 }}>{app.stat}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: p['text-secondary'], lineHeight: 1.4, margin: 0 }}>{app.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Todo Widget */}
            <div className="d-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16, borderBottom: `1px solid ${p.border}`, paddingBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Todo</span>
                  <span style={{ fontSize: 11, color: p['text-secondary'], background: p.muted, padding: '1px 8px', borderRadius: 4 }}>Hoy</span>
                </div>
                <button onClick={() => setModal('new-task')} className="d-btn" style={{ background: p.primary, color: 'white', padding: '6px 16px', fontSize: 12, borderRadius: 6 }}>+ Tarea</button>
              </div>
              {tasks.map((task, i) => (
                <div key={i} onClick={() => setDetailTask(task.title)}
                  style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < tasks.length - 1 ? `1px solid ${p.border}` : 'none', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${p.border}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{task.title}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: `${pColors[task.priority]}15`, color: pColors[task.priority] }}>{task.priority}</span>
                      <span style={{ fontSize: 11, color: p['text-secondary'] }}>{task.emoji} {task.category}</span>
                      <span style={{ fontSize: 11, color: task.due === 'Hoy' ? p.primary : p['text-secondary'], fontWeight: task.due === 'Hoy' ? 600 : 400 }}>{task.due}</span>
                    </div>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: p.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: p.text, flexShrink: 0 }}>{task.assignee[0]}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: p.primary, fontWeight: 600, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>

            {/* Inspiration Widget */}
            <div className="d-card" style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, padding: 20 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16, borderBottom: `1px solid ${p.border}`, paddingBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Inspiración</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 4, background: p.primary + '12', color: p.primary }}>{ideas.reduce((sum, i) => sum + i.votes, 0)} votos</span>
              </div>
              {ideas.map((idea, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < ideas.length - 1 ? `1px solid ${p.border}` : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: p.muted, color: p['text-secondary'] }}>{idea.type === 'new_app' ? 'APP' : 'MEJORA'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{idea.title}</p>
                    <p style={{ fontSize: 11, color: p['text-secondary'], margin: '2px 0 0' }}>{idea.votes} votos · {idea.comments} comentarios</p>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: p['text-secondary'], padding: '8px 0' }}>
                ✅ Migrar fotos a la nube <span style={{ color: p['text-secondary'] }}>— hace 3 días</span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: p.primary, fontWeight: 600, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        {view === 'mobile' && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: p.surface, borderTop: `1px solid ${p.border}`, padding: '6px 12px', display: 'flex', justifyContent: 'space-around' }}>
            {['Home', 'Todo', 'Insp.', 'Split', '⋯'].map((l, i) => (
              <div key={i} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: i === 0 ? p.primary : p['text-secondary'], cursor: 'pointer' }}>{l}</div>
            ))}
          </div>
        )}

        <footer style={{ textAlign: 'center', padding: '20px', borderTop: `1px solid ${p.border}`, color: p['text-secondary'], fontSize: 11 }}>
          Propuesta &ldquo;Clarity&rdquo; — 027Apps · Professional Series
        </footer>

        {/* New Task Modal */}
        {modal === 'new-task' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setModal(null)} />
            <div style={{ position: 'relative', background: p.surface, borderRadius: 8, width: '90%', maxWidth: 480, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                <h3 className="dh" style={{ fontSize: 18, color: p.text, margin: 0 }}>Nueva tarea</h3>
                <button onClick={() => setModal(null)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: p.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input className="d-input" placeholder="Título" style={{ background: p.muted, border: `1px solid ${p.border}`, color: p.text, padding: '10px 14px', fontSize: 14, width: '100%', borderRadius: 6 }} />
                <textarea className="d-input" placeholder="Descripción" rows={3} style={{ background: p.muted, border: `1px solid ${p.border}`, color: p.text, padding: '10px 14px', fontSize: 14, width: '100%', borderRadius: 6, resize: 'none' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select className="d-input" style={{ background: p.muted, border: `1px solid ${p.border}`, color: p.text, padding: '10px 14px', fontSize: 13, borderRadius: 6, appearance: 'none' }}>
                    <option>Categoría</option><option>🏠 Hogar</option><option>👶 Nico</option><option>💰 Finanzas</option>
                  </select>
                  <select className="d-input" style={{ background: p.muted, border: `1px solid ${p.border}`, color: p.text, padding: '10px 14px', fontSize: 13, borderRadius: 6, appearance: 'none' }}>
                    <option>Prioridad</option><option>Urgente</option><option>Alta</option><option>Media</option><option>Baja</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="date" className="d-input" style={{ background: p.muted, border: `1px solid ${p.border}`, color: p.text, padding: '10px 14px', fontSize: 13, borderRadius: 6, flex: 1 }} />
                  <label style={{ fontSize: 12, color: p['text-secondary'], display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" style={{ accentColor: p.primary }} /> Sin fecha
                  </label>
                </div>
                <button className="d-btn" style={{ background: p.primary, color: 'white', padding: '12px', fontSize: 14, borderRadius: 6, marginTop: 4 }}>Crear tarea</button>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {detailTask && detailTaskData && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDetailTask(null)} />
            <div style={{ position: 'relative', background: p.surface, borderRadius: 8, width: '90%', maxWidth: 380, padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.15)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3 className="dh" style={{ fontSize: 17, color: p.text, margin: 0 }}>{detailTaskData.title}</h3>
                <button onClick={() => setDetailTask(null)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: p.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${pColors[detailTaskData.priority]}15`, color: pColors[detailTaskData.priority] }}>{detailTaskData.priority}</span>
                <span style={{ fontSize: 11, color: p['text-secondary'] }}>{detailTaskData.emoji} {detailTaskData.category}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: detailTaskData.due === 'Hoy' ? p.primary : p['text-secondary'] }}>{detailTaskData.due === 'Hoy' ? '⚠ Vence hoy' : `Vence: ${detailTaskData.due}`}</span>
              </div>
              <p style={{ fontSize: 13, color: p['text-secondary'], lineHeight: 1.6, marginBottom: 20 }}>Asignada a <strong style={{ color: p.text }}>{detailTaskData.assignee}</strong>.</p>
              <div className="flex gap-2">
                <button className="d-btn" style={{ background: p.primary, color: 'white', padding: '10px 20px', fontSize: 13, borderRadius: 6 }}>Marcar hecha</button>
                <button className="d-btn" style={{ background: 'transparent', color: p.text, border: `1px solid ${p.border}`, padding: '10px 20px', fontSize: 13, borderRadius: 6 }}>Editar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
