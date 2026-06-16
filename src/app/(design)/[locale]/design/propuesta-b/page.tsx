'use client'

import { useState } from 'react'
import Link from 'next/link'

const palettes = {
  light: {
    bg: '#FAFAFA', surface: '#FFFFFF', surface2: '#F1F1F1',
    primary: '#9B1C1C', 'primary-hover': '#7E1515', 'primary-soft': '#FFF1F0',
    secondary: '#0F172A', 'secondary-hover': '#1E293B',
    accent: '#DC2626', 'accent-hover': '#B91C1C',
    text: '#0A0A0A', 'text-secondary': '#6B7280',
    border: '#E5E7EB', muted: '#F3F4F6', glow: 'rgba(155, 28, 28, 0.12)',
  },
  dark: {
    bg: '#0A0A0F', surface: '#12121A', surface2: '#1A1A24',
    primary: '#E84A4A', 'primary-hover': '#F05E5E', 'primary-soft': '#2A1414',
    secondary: '#F8FAFC', 'secondary-hover': '#E2E8F0',
    accent: '#FF4444', 'accent-hover': '#FF6666',
    text: '#F8FAFC', 'text-secondary': '#94A3B8',
    border: '#1E1E2A', muted: '#16161E', glow: 'rgba(232, 74, 74, 0.15)',
  },
}

const APP_COLORS: Record<string, string> = {
  todo: '#4F46E5', inspiration: '#F59E0B', splitwise: '#10B981',
}

const pColors: Record<string, string> = { urgent: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#6B7280' }

export default function PropuestaB() {
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')
  const [userOpen, setUserOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [modal, setModal] = useState<'new-task' | null>(null)
  const [detailTask, setDetailTask] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState('Familia')
  const [taskForm, setTaskForm] = useState({ title: '', description: '', category: '🏠 Hogar', priority: 'medium', date: '', noDate: false })
  const t = theme
  const p = palettes[t]

  const tasks = [
    { title: 'Comprar leche y pan', priority: 'medium', category: '🏠 Hogar', due: 'Hoy', assignee: 'Eric', description: 'Comprar en Mercadona: leche entera, pan de molde integral y mantequilla.' },
    { title: 'Pedir cita pediatra', priority: 'high', category: '👶 Nico', due: 'Mañana', assignee: 'Eric', description: 'Llamar al centro de salud para revisión de los 6 meses.' },
    { title: 'Pagar factura luz', priority: 'urgent', category: '💰 Finanzas', due: 'Viernes', assignee: 'María', description: 'Factura de Endesa del mes de junio. Referencia: 2024-ES-004567.' },
  ]

  const detailTaskData = tasks.find(tk => tk.title === detailTask)

  return (
    <div className={t} style={{ background: p.bg, color: p.text, fontFamily: '"DM Sans", system-ui, sans-serif', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .bh { font-family: "Plus Jakarta Sans", sans-serif; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
        .bb { font-family: "DM Sans", system-ui, sans-serif; }
        .b-btn { font-family: "DM Sans", sans-serif; font-weight: 700; transition: all 0.15s; cursor: pointer; border: none; letter-spacing: 0.01em; }
        .b-btn:active { transform: scale(0.96); }
        .b-card { transition: all 0.25s; }
        .b-card:hover { box-shadow: 0 20px 60px rgba(0,0,0,0.1); transform: translateY(-1px); }
        .b-input { font-family: "DM Sans", sans-serif; outline: none; transition: all 0.15s; }
        .b-input:focus { box-shadow: 0 0 0 3px var(--b-glow, rgba(155,28,28,0.12)); }
      `}</style>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '12px 24px 4px' }}>
        {(['desktop', 'mobile'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '4px 14px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
              background: view === v ? p.primary : 'transparent',
              color: view === v ? 'white' : p['text-secondary'],
              border: 'none', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
            }}
          >{v === 'desktop' ? '🖥 DESKTOP' : '📱 MOBILE'}</button>
        ))}
        <button onClick={toggleTheme}
          style={{
            padding: '4px 14px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            background: 'transparent', color: p['text-secondary'], cursor: 'pointer', border: 'none',
            fontFamily: '"DM Sans", sans-serif',
          }}
        >{theme === 'light' ? '🌙 DARK' : '☀️ LIGHT'}</button>
      </div>

      <div style={{ margin: '0 auto', maxWidth: view === 'mobile' ? 375 : 1280, transition: 'max-width 0.3s' }}>
        {/* Nav entre propuestas */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', padding: '16px 24px 0' }}>
          {['B', 'D', 'H'].map((l) => (
            <Link key={l} href={`/en/design/propuesta-${l.toLowerCase()}`}
              style={{
                padding: '6px 18px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                background: l === 'B' ? p.primary : 'transparent',
                color: l === 'B' ? 'white' : p['text-secondary'],
                textDecoration: 'none', transition: 'all 0.15s',
              }}
            >Propuesta {l}</Link>
          ))}
        </div>

        {/* Header mockup */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderBottom: `2px solid ${p.border}`, background: p.surface }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 30, height: 30, borderRadius: 6, background: p.primary }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,12 8,12 10,18 14,6 16,12 20,12"/></svg>
            </div>
            <span className="bh" style={{ fontSize: 14, color: p.text, display: view === 'mobile' ? 'none' : 'inline' }}>027Apps</span>

            {/* Group switcher dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={(e) => { e.stopPropagation(); setGroupOpen(!groupOpen); setUserOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: p.muted, borderRadius: 4, border: `1px solid ${p.border}`,
                  padding: '3px 10px 3px 3px', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 4, background: p.primary, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white',
                }}>{selectedGroup.slice(0, 2).toUpperCase()}</div>
                <span className="bb" style={{ fontSize: 12, fontWeight: 700, color: p.text }}>{selectedGroup}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>
              {groupOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setGroupOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, width: 192,
                    background: p.surface, borderRadius: 4, border: `1px solid ${p.border}`,
                    padding: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                  }}>
                    <div
                      onClick={() => { setSelectedGroup('Familia'); setGroupOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px',
                        borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        color: selectedGroup === 'Familia' ? p.primary : p.text,
                        background: selectedGroup === 'Familia' ? p.muted : 'transparent',
                      }}
                    >
                      <span className="bb">Familia</span>
                      {selectedGroup === 'Familia' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={p.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                      )}
                    </div>
                    <div
                      onClick={() => { setSelectedGroup('Trabajo'); setGroupOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px',
                        borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        color: selectedGroup === 'Trabajo' ? p.primary : p.text,
                        background: selectedGroup === 'Trabajo' ? p.muted : 'transparent',
                      }}
                    >
                      <span className="bb">Trabajo</span>
                      <span className="bb" style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: p.primary, color: 'white' }}>ADMIN</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 4, border: `1.5px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p['text-secondary']} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>

            {/* User avatar dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen); setGroupOpen(false) }}
                style={{ width: 30, height: 30, borderRadius: 4, background: p.text, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.bg, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
              >ER</div>
              {userOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setUserOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, width: 192,
                    background: p.surface, borderRadius: 4, border: `1px solid ${p.border}`,
                    padding: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                  }}>
                    <div
                      onClick={() => setUserOpen(false)}
                      style={{ padding: '8px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: p.text }}
                      className="bb"
                    >Editar perfil</div>
                    <div
                      onClick={() => setUserOpen(false)}
                      style={{ padding: '8px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: p.text }}
                      className="bb"
                    >Backoffice</div>
                    <div style={{ height: 1, background: p.border, margin: '4px 0' }} />
                    <div
                      onClick={() => setUserOpen(false)}
                      style={{ padding: '8px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: p.accent }}
                      className="bb"
                    >Cerrar sesión</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Subnav */}
        <div style={{ display: view === 'mobile' ? 'none' : 'flex', gap: 0, padding: '8px 24px', borderBottom: `1.5px solid ${p.border}`, background: p.surface }}>
          {['🏠', '✓ Todo', '💡 Inspiración', '€ Splitwise'].map((item, i) => (
            <span key={i} style={{
              padding: '6px 18px', fontSize: 12, fontWeight: i === 0 ? 800 : 500, color: i === 0 ? p.primary : p['text-secondary'],
              borderBottom: i === 0 ? `2px solid ${p.primary}` : '2px solid transparent', cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{item}</span>
          ))}
        </div>

        {/* Dashboard */}
        <div style={{ padding: view === 'mobile' ? '0 16px 80px' : '0 24px 80px' }}>
          {/* Your Apps */}
          <section style={{ marginBottom: 32 }}>
            <h2 className="bh" style={{ fontSize: 18, color: p.text, margin: '0 0 16px' }}>Tus apps</h2>
            <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { slug: 'todo', name: 'Todo', desc: 'Gestiona las tareas de la familia', stat: '12 tareas' },
                { slug: 'inspiration', name: 'Inspiración', desc: 'Comparte y vota ideas', stat: '8 activas' },
                { slug: 'splitwise', name: 'Splitwise', desc: 'Reparto de gastos', stat: '€234 este mes' },
              ].map((app) => (
                <div key={app.slug} className="b-card" style={{ background: p.surface, border: t === 'light' ? `1px solid ${p.border}` : 'none', padding: 20, borderRadius: 4, cursor: 'pointer' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: APP_COLORS[app.slug], marginBottom: 12 }} />
                  <div className="flex items-baseline justify-between">
                    <p className="bh" style={{ fontSize: 16, margin: '0 0 4px', color: p.text }}>{app.name}</p>
                    <span className="bb" style={{ fontSize: 11, fontWeight: 700, color: p.primary }}>{app.stat}</span>
                  </div>
                  <p className="bb" style={{ fontSize: 12, color: p['text-secondary'], margin: 0, lineHeight: 1.4 }}>{app.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: view === 'mobile' ? '1fr' : '1fr 1fr', gap: 8 }}>
            {/* Todo Widget */}
            <div className="b-card" style={{ background: p.surface, border: t === 'light' ? `1px solid ${p.border}` : 'none', padding: 24, borderRadius: 4 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16, borderBottom: `1.5px solid ${p.border}`, paddingBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 24, height: 24, borderRadius: 4, background: APP_COLORS.todo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white' }}>✓</span>
                  <span className="bh" style={{ fontSize: 15, color: p.text, textTransform: 'uppercase' }}>To-Do</span>
                </div>
                <button
                  onClick={() => setModal('new-task')}
                  className="b-btn"
                  style={{
                    padding: '5px 14px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.5, background: p.primary, color: 'white', cursor: 'pointer',
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >+ Nueva</button>
              </div>
              {tasks.map((task, i) => (
                <div key={i}
                  onClick={() => setDetailTask(task.title)}
                  style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < tasks.length - 1 ? `1px solid ${p.border}` : 'none', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${p.border}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="bb" style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{task.title}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span className="bb" style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', background: `${pColors[task.priority]}15`, color: pColors[task.priority] }}>{task.priority.toUpperCase()}</span>
                      <span className="bb" style={{ fontSize: 10, color: p['text-secondary'] }}>{task.category}</span>
                      <span className="bb" style={{ fontSize: 10, color: task.due === 'Hoy' ? p.accent : p['text-secondary'], fontWeight: 600 }}>{task.due === 'Hoy' ? '⚠ HOY' : task.due.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: p.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: p.text, flexShrink: 0 }}>{task.assignee[0]}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <span className="bb" style={{ fontSize: 11, fontWeight: 700, color: p.primary, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>

            {/* Inspiration Widget */}
            <div className="b-card" style={{ background: p.surface, border: t === 'light' ? `1px solid ${p.border}` : 'none', padding: 24, borderRadius: 4 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16, borderBottom: `1.5px solid ${p.border}`, paddingBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 24, height: 24, borderRadius: 4, background: APP_COLORS.inspiration, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white' }}>💡</span>
                  <span className="bh" style={{ fontSize: 15, color: p.text, textTransform: 'uppercase' }}>Inspiración</span>
                </div>
                <span className="bb" style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: p.primary, color: 'white' }}>8</span>
              </div>
              {[
                { title: 'App para recetas de cocina', type: 'new_app', votes: 12, comments: 5 },
                { title: 'Recordatorio de riego plantas', type: 'improvement', votes: 8, comments: 3 },
              ].map((idea, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 1 ? `1px solid ${p.border}` : 'none' }}>
                  <span className="bb" style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', background: p.muted, color: p['text-secondary'], textTransform: 'uppercase' }}>{idea.type === 'new_app' ? 'APP' : 'MEJORA'}</span>
                  <div style={{ flex: 1 }}>
                    <p className="bb" style={{ fontSize: 13, fontWeight: 600, color: p.text, margin: 0 }}>{idea.title}</p>
                    <p className="bb" style={{ fontSize: 11, color: p['text-secondary'], margin: '2px 0 0' }}>♥ {idea.votes} · 💬 {idea.comments}</p>
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 0' }}>
                <p className="bb" style={{ fontSize: 12, color: p['text-secondary'], margin: 0 }}>✅ Migrar fotos a la nube <span style={{ color: p['text-secondary'], fontWeight: 400 }}>— hace 3 días</span></p>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <span className="bb" style={{ fontSize: 11, fontWeight: 700, color: p.primary, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}>Ver todas →</span>
              </div>
            </div>
          </div>
        </div>

        {/* New Task Modal */}
        {modal === 'new-task' && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => { setModal(null); setTaskForm({ title: '', description: '', category: '🏠 Hogar', priority: 'medium', date: '', noDate: false }) }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: p.surface, borderRadius: 4, border: `1px solid ${p.border}`,
                padding: 24, width: '100%', maxWidth: 480, margin: '0 16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <span className="bh" style={{ fontSize: 16, color: p.text, textTransform: 'uppercase' }}>Nueva tarea</span>
                <button
                  onClick={() => { setModal(null); setTaskForm({ title: '', description: '', category: '🏠 Hogar', priority: 'medium', date: '', noDate: false }) }}
                  style={{ width: 28, height: 28, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 16, fontWeight: 700 }}
                >✕</button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="bb" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p['text-secondary'], marginBottom: 6, letterSpacing: 0.5 }}>Título</label>
                <input
                  className="b-input"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 4, fontSize: 13,
                    background: p.muted, border: `1px solid ${p.border}`, color: p.text,
                    fontFamily: '"DM Sans", sans-serif', boxSizing: 'border-box',
                  }}
                  placeholder="Escribe el título de la tarea"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="bb" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p['text-secondary'], marginBottom: 6, letterSpacing: 0.5 }}>Descripción</label>
                <textarea
                  className="b-input"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 4, fontSize: 13,
                    background: p.muted, border: `1px solid ${p.border}`, color: p.text,
                    fontFamily: '"DM Sans", sans-serif', resize: 'vertical', boxSizing: 'border-box',
                  }}
                  placeholder="Descripción opcional"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label className="bb" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p['text-secondary'], marginBottom: 6, letterSpacing: 0.5 }}>Categoría</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 4, fontSize: 13,
                      background: p.muted, border: `1px solid ${p.border}`, color: p.text,
                      fontFamily: '"DM Sans", sans-serif', cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  >
                    <option>🏠 Hogar</option>
                    <option>👶 Nico</option>
                    <option>💰 Finanzas</option>
                    <option>📋 Trabajo</option>
                    <option>🏥 Salud</option>
                  </select>
                </div>
                <div>
                  <label className="bb" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p['text-secondary'], marginBottom: 6, letterSpacing: 0.5 }}>Prioridad</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 4, fontSize: 13,
                      background: p.muted, border: `1px solid ${p.border}`, color: p.text,
                      fontFamily: '"DM Sans", sans-serif', cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="bb" style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p['text-secondary'], marginBottom: 6, letterSpacing: 0.5 }}>Fecha límite</label>
                <input
                  type="date"
                  value={taskForm.date}
                  onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                  disabled={taskForm.noDate}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 4, fontSize: 13,
                    background: p.muted, border: `1px solid ${p.border}`, color: p.text,
                    fontFamily: '"DM Sans", sans-serif', boxSizing: 'border-box',
                    opacity: taskForm.noDate ? 0.4 : 1,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={taskForm.noDate}
                    onChange={(e) => setTaskForm({ ...taskForm, noDate: e.target.checked, date: e.target.checked ? '' : taskForm.date })}
                    style={{ accentColor: p.primary, cursor: 'pointer' }}
                  />
                  <span className="bb" style={{ fontSize: 11, color: p['text-secondary'] }}>Sin fecha</span>
                </label>
              </div>

              <button
                className="b-btn"
                onClick={() => { setModal(null); setTaskForm({ title: '', description: '', category: '🏠 Hogar', priority: 'medium', date: '', noDate: false }) }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 4, fontSize: 13, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  background: p.primary, color: 'white', cursor: 'pointer',
                  fontFamily: '"DM Sans", sans-serif',
                }}
              >Crear tarea</button>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {detailTaskData && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setDetailTask(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: p.surface, borderRadius: 4, border: `1px solid ${p.border}`,
                padding: 24, width: '100%', maxWidth: 480, margin: '0 16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <span className="bh" style={{ fontSize: 16, color: p.text, textTransform: 'uppercase' }}>Detalle tarea</span>
                <button
                  onClick={() => setDetailTask(null)}
                  style={{ width: 28, height: 28, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p['text-secondary'], fontSize: 16, fontWeight: 700 }}
                >✕</button>
              </div>

              <h3 className="bh" style={{ fontSize: 18, color: p.text, margin: '0 0 12px' }}>{detailTaskData.title}</h3>

              <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                <span className="bb" style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${pColors[detailTaskData.priority]}15`, color: pColors[detailTaskData.priority], textTransform: 'uppercase' }}>
                  {detailTaskData.priority}
                </span>
                <span className="bb" style={{ fontSize: 11, color: p['text-secondary'], background: p.muted, padding: '2px 8px', borderRadius: 4 }}>
                  {detailTaskData.category}
                </span>
                <span className="bb" style={{ fontSize: 11, fontWeight: 600, color: detailTaskData.due === 'Hoy' ? p.accent : p['text-secondary'], background: p.muted, padding: '2px 8px', borderRadius: 4 }}>
                  {detailTaskData.due === 'Hoy' ? '⚠ HOY' : detailTaskData.due.toUpperCase()}
                </span>
              </div>

              <div style={{ background: p.muted, borderRadius: 4, padding: '10px 12px', marginBottom: 20 }}>
                <p className="bb" style={{ fontSize: 13, color: p['text-secondary'], margin: 0, lineHeight: 1.5 }}>
                  {detailTaskData.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="b-btn"
                  onClick={() => setDetailTask(null)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    background: p.primary, color: 'white', cursor: 'pointer',
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >Marcar hecha</button>
                <button
                  className="b-btn"
                  onClick={() => setDetailTask(null)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    background: p.muted, color: p.text, cursor: 'pointer',
                    fontFamily: '"DM Sans", sans-serif', border: `1px solid ${p.border}`,
                  }}
                >Editar</button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom nav (mobile) */}
        {view === 'mobile' && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: p.surface, borderTop: `1.5px solid ${p.border}`, padding: '6px 12px', display: 'flex', justifyContent: 'space-around' }}>
            {['🏠', '✓', '💡', '€', '⋯'].map((icon, i) => (
              <div key={i} style={{ width: 36, height: 36, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? p.muted : 'transparent', cursor: 'pointer', fontSize: 16 }}>{icon}</div>
            ))}
          </div>
        )}

        <footer style={{ textAlign: 'center', padding: '24px', borderTop: `1.5px solid ${p.border}`, color: p['text-secondary'], fontSize: 11 }} className="bb">
          Propuesta &ldquo;Pulso&rdquo; — 027Apps · Hecho con ❤️ para la familia
        </footer>
      </div>
    </div>
  )
}
