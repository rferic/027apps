'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Trash2, Search, ExternalLink, Users, Pencil, ChevronDown, ChevronRight, Plus, X, Wallet, ArrowLeftRight, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { DsButton } from '@/components/ds/button'
import { DsCard } from '@/components/ds/card'
import { DsSkeleton } from '@/components/ds/skeleton'
import { DsEmptyState } from '@/components/ds/empty-state'
import { DsBadge } from '@/components/ds/badge'
import { DsConfirmModal } from '@/components/ds/confirm-modal'
import { DsToggle } from '@/components/ds/toggle'
import { DsModal } from '@/components/ds/modal'

interface Group {
  id: string; title: string; emoji: string; currency: string;
  group_id: string; created_at: string;
  parentGroup?: { name: string; slug: string } | null;
  members?: number; totalExpenses?: number;
}

function formatAmount(amount: number, currency: string): string {
  return `${currency}${amount.toFixed(2)}`
}

export default function SplitExpensesAdmin() {
  const t = useTranslations('admin.splitExpenses')
  const locale = useLocale()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [groupDetail, setGroupDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editGroup, setEditGroup] = useState<any>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'members' | 'expenses' | 'transfers'>('overview')

  // Edit group form
  const [editTitle, setEditTitle] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editCurrency, setEditCurrency] = useState('')

  // Add member
  const [showAddMember, setShowAddMember] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<{ id: string; display_name: string }[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')

  async function fetchAllGroups() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/apps/split-expenses?with_details=1', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups ?? [])
      }
    } catch { toast.error(t('loadError')) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAllGroups() }, [refresh])

  async function fetchGroupDetail(id: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${id}&with_details=1`, { credentials: 'include' })
      if (res.ok) setGroupDetail(await res.json())
    } catch {}
    finally { setDetailLoading(false) }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); setGroupDetail(null) }
    else { setExpandedId(id); fetchGroupDetail(id) }
  }

  async function handleDeleteGroup(id: string) {
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { toast.success(t('deleted')); setDeleteId(null); setRefresh(r => r + 1) }
    else toast.error(t('deleteError'))
  }

  async function handleSaveEdit() {
    if (!editGroup) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${editGroup}&action=`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, emoji: editEmoji, currency: editCurrency }), credentials: 'include' })
    if (res.ok) { toast.success('Grupo actualizado'); setEditGroup(null); setRefresh(r => r + 1); if (expandedId) fetchGroupDetail(expandedId) }
    else toast.error('Error al actualizar')
  }

  async function handleToggleMember(memberId: string, active: boolean) {
    if (!expandedId) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${expandedId}&action=member`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, active }), credentials: 'include' })
    if (res.ok) fetchGroupDetail(expandedId)
    else toast.error('Error')
  }

  async function handleAddMember() {
    if (!expandedId || !selectedUserId) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${expandedId}&action=add_member`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selectedUserId }), credentials: 'include' })
    if (res.ok) { toast.success('Miembro añadido'); setShowAddMember(false); setSelectedUserId(''); fetchGroupDetail(expandedId) }
    else toast.error('Error')
  }

  async function handleDeleteExpense() {
    if (!expandedId || !deleteExpenseId) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${expandedId}&action=delete_expense`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expense_id: deleteExpenseId }), credentials: 'include' })
    if (res.ok) { toast.success('Gasto eliminado'); setDeleteExpenseId(null); fetchGroupDetail(expandedId) }
    else toast.error('Error')
  }

  async function handleDeleteTransfer() {
    if (!expandedId || !deleteTransferId) return
    const res = await fetch(`/api/v1/admin/apps/split-expenses?id=${expandedId}&action=delete_transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transfer_id: deleteTransferId }), credentials: 'include' })
    if (res.ok) { toast.success('Transferencia eliminada'); setDeleteTransferId(null); fetchGroupDetail(expandedId) }
    else toast.error('Error')
  }

  async function openAddMember() {
    setShowAddMember(true)
    // Fetch all users (using the admin members endpoint)
    try {
      const res = await fetch('/api/v1/admin/users', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const existingIds = new Set((groupDetail?.members ?? []).map((m: any) => m.user_id))
        const userList = data?.data ?? data ?? []
        setAvailableUsers(userList.filter((u: any) => !existingIds.has(u.user_id ?? u.id)).map((u: any) => ({ id: u.user_id ?? u.id, display_name: u.display_name ?? u.displayName ?? u.email })))
      }
    } catch { setAvailableUsers([]) }
  }

  const filtered = groups.filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{t('title')}</h2>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
          />
        </div>
      </div>

      {loading ? (
        <DsSkeleton height={48} count={5} />
      ) : filtered.length === 0 ? (
        <DsEmptyState title={t('empty')} />
      ) : (
        <div className="space-y-2">
          {filtered.map(g => (
            <div key={g.id}>
              <DsCard padding="md" hover={false}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => toggleExpand(g.id)} className="flex items-center justify-center w-6 h-6 rounded hover:bg-accent cursor-pointer">
                    {expandedId === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span style={{ fontSize: 24, cursor: 'pointer' }} onClick={() => toggleExpand(g.id)}>{g.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleExpand(g.id)}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{g.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      {g.parentGroup?.name ?? '—'} · {g.members ?? 0} miembros · {formatAmount(g.totalExpenses ?? 0, g.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditGroup(g.id); setEditTitle(g.title); setEditEmoji(g.emoji); setEditCurrency(g.currency) }}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Editar grupo">
                      <Pencil size={14} />
                    </button>
                    {g.parentGroup?.slug && (
                      <Link href={`/${locale}/${g.parentGroup.slug}/apps/split-expenses`}
                        target="_blank" rel="noopener"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Entrar al grupo">
                        <ExternalLink size={14} />
                      </Link>
                    )}
                    <button onClick={() => setDeleteId(g.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar grupo">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </DsCard>

              {expandedId === g.id && (
                <div style={{ border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', overflow: 'hidden' }}>
                  {detailLoading ? (
                    <div style={{ padding: 24 }}><DsSkeleton height={60} count={3} /></div>
                  ) : groupDetail ? (
                    <>
                      {/* Overview header */}
                      <div style={{ padding: '16px 20px', background: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 24 }}>{g.emoji}</span>
                          <div>
                            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{g.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                              {g.parentGroup?.name ?? '—'} · {g.members ?? 0} miembros
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>Total gastos</p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{formatAmount(groupDetail.expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) ?? 0, g.currency)}</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>Transferencias</p>
                            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{groupDetail.transfers?.length ?? 0}</p>
                          </div>
                          {g.parentGroup?.slug && (
                            <Link href={`/${locale}/${g.parentGroup.slug}/apps/split-expenses`} target="_blank" rel="noopener"
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors no-underline">
                              <ExternalLink size={12} /> Ver app completa
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', padding: '0 16px', background: 'var(--color-surface)' }}>
                        {[
                          { key: 'overview' as const, label: 'Resumen', icon: BarChart3 },
                          { key: 'members' as const, label: `Miembros (${groupDetail.members?.length ?? 0})`, icon: Users },
                          { key: 'expenses' as const, label: `Gastos (${groupDetail.expenses?.length ?? 0})`, icon: Wallet },
                          { key: 'transfers' as const, label: `Transferencias (${groupDetail.transfers?.length ?? 0})`, icon: ArrowLeftRight },
                        ].map(tab => (
                          <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                            style={{
                              padding: '10px 14px', fontSize: 12, fontWeight: detailTab === tab.key ? 600 : 400,
                              border: 'none', borderBottom: detailTab === tab.key ? '2px solid #10B981' : '2px solid transparent',
                              background: 'transparent', color: detailTab === tab.key ? '#10B981' : 'var(--color-text-secondary)',
                              cursor: 'pointer', transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <tab.icon size={13} />{tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div style={{ padding: 20 }}>
                        {detailTab === 'overview' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                            <DsCard padding="md" hover={false}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Gastos totales</p>
                              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{formatAmount(groupDetail.expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) ?? 0, g.currency)}</p>
                            </DsCard>
                            <DsCard padding="md" hover={false}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Miembros</p>
                              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{groupDetail.members?.length ?? 0}</p>
                            </DsCard>
                            <DsCard padding="md" hover={false}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Movimientos</p>
                              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{groupDetail.expenses?.length ?? 0}</p>
                            </DsCard>
                            <DsCard padding="md" hover={false}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Transferencias</p>
                              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{groupDetail.transfers?.length ?? 0}</p>
                            </DsCard>
                          </div>
                        )}

                        {detailTab === 'members' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs text-muted-foreground">{groupDetail.members?.length ?? 0} miembros</span>
                              <DsButton size="sm" color="#10B981" onClick={openAddMember}><Plus size={12} /> Añadir</DsButton>
                            </div>
                            {groupDetail.members?.map((m: any) => (
                              <DsCard key={m.id} padding="sm" hover={false}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                    {(m.display_name ?? '?')[0]}
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', flex: 1 }}>{m.display_name ?? m.user_id}</span>
                                  <DsToggle checked={m.active} onChange={(val) => handleToggleMember(m.id, val)} color="#10B981" />
                                </div>
                              </DsCard>
                            ))}
                          </div>
                        )}

                        {detailTab === 'expenses' && (
                          <div className="space-y-2">
                            {groupDetail.expenses?.map((e: any) => (
                              <DsCard key={e.id} padding="sm" hover={false}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--color-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', flexDirection: 'column', flexShrink: 0 }}>
                                    <span>{new Date(e.created_at).getDate()}</span>
                                    <span style={{ fontSize: 9 }}>{new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(e.created_at))}</span>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>{e.title}</p>
                                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{e.paid_by_name ?? '—'}</p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{formatAmount(Number(e.amount), g.currency)}</span>
                                    <button onClick={() => setDeleteExpenseId(e.id)}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </DsCard>
                            ))}
                          </div>
                        )}

                        {detailTab === 'transfers' && (
                          <div className="space-y-2">
                            {groupDetail.transfers?.map((t: any) => (
                              <DsCard key={t.id} padding="sm" hover={false}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <ArrowLeftRight size={16} className="text-emerald-500 flex-shrink-0" />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
                                      {t.from_name ?? '—'} → {t.to_name ?? '—'}
                                    </p>
                                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                                      {new Date(t.created_at).toLocaleDateString(locale)}
                                      {t.is_manual ? ' · Manual' : ''} · {t.status}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{formatAmount(Number(t.amount), g.currency)}</span>
                                    <button onClick={() => setDeleteTransferId(t.id)}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </DsCard>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete group confirm */}
      <DsConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)}
        title="Eliminar grupo" message="¿Eliminar este grupo de gastos? Esta acción no se puede deshacer."
        confirmLabel="Eliminar" cancelLabel="Cancelar"
        onConfirm={async () => { if (deleteId) await handleDeleteGroup(deleteId) }}
      />

      {/* Delete expense confirm */}
      <DsConfirmModal open={!!deleteExpenseId} onClose={() => setDeleteExpenseId(null)}
        title="Eliminar gasto" message="¿Eliminar este gasto?"
        confirmLabel="Eliminar" cancelLabel="Cancelar"
        onConfirm={handleDeleteExpense}
      />

      {/* Delete transfer confirm */}
      <DsConfirmModal open={!!deleteTransferId} onClose={() => setDeleteTransferId(null)}
        title="Eliminar transferencia" message="¿Eliminar esta transferencia?"
        confirmLabel="Eliminar" cancelLabel="Cancelar"
        onConfirm={handleDeleteTransfer}
      />

      {/* Edit group modal */}
      <DsModal open={!!editGroup} onClose={() => setEditGroup(null)} title="Editar grupo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Emoji</label>
            <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
            <input value={editCurrency} onChange={e => setEditCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground" />
          </div>
          <div className="flex justify-end gap-2">
            <DsButton variant="ghost" onClick={() => setEditGroup(null)}>Cancelar</DsButton>
            <DsButton color="#10B981" onClick={handleSaveEdit}>Guardar</DsButton>
          </div>
        </div>
      </DsModal>

      {/* Add member modal */}
      <DsModal open={showAddMember} onClose={() => setShowAddMember(false)} title="Añadir miembro">
        <div className="space-y-4">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground">
            <option value="">Seleccionar usuario...</option>
            {availableUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <DsButton variant="ghost" onClick={() => setShowAddMember(false)}>Cancelar</DsButton>
            <DsButton color="#10B981" disabled={!selectedUserId} onClick={handleAddMember}>Añadir</DsButton>
          </div>
        </div>
      </DsModal>
    </div>
  )
}
