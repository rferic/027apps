import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Receipt, ShoppingCart, ShoppingBag, Banknote, CreditCard, ArrowLeftRight, ArrowRightLeft, Send, ArrowUpDown, Repeat } from 'lucide-react'

const expenseIcons = [
  { name: 'Receipt', Icon: Receipt, active: true, note: 'actual' },
  { name: 'ShoppingCart', Icon: ShoppingCart },
  { name: 'ShoppingBag', Icon: ShoppingBag },
  { name: 'Banknote', Icon: Banknote },
  { name: 'CreditCard', Icon: CreditCard },
]

const transferIcons = [
  { name: 'ArrowLeftRight', Icon: ArrowLeftRight, active: true, note: 'actual' },
  { name: 'ArrowRightLeft', Icon: ArrowRightLeft },
  { name: 'Send', Icon: Send },
  { name: 'ArrowUpDown', Icon: ArrowUpDown },
  { name: 'Repeat', Icon: Repeat },
]

function IconPicker() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: 24, maxWidth: 600 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Gasto</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>Iconos outline — mismo grosor, mismo estilo visual</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {expenseIcons.map(({ name, Icon, active, note }) => (
            <div key={name} style={{
              background: active ? '#FEF3C7' : 'var(--color-surface)',
              border: `2px solid ${active ? '#3B82F6' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '14px 8px', gap: 8,
            }}>
              <Icon size={22} style={{ color: '#3B82F6' }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{name}</span>
              {note && <span style={{ fontSize: 9, color: '#3B82F6', fontWeight: 600 }}>{note}</span>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Transferencia</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>Iconos outline — mismo grosor, todos direccionales</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {transferIcons.map(({ name, Icon, active, note }) => (
            <div key={name} style={{
              background: active ? '#D1FAE5' : 'var(--color-surface)',
              border: `2px solid ${active ? '#10B981' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '14px 8px', gap: 8,
            }}>
              <Icon size={22} style={{ color: '#10B981' }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{name}</span>
              {note && <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }}>{note}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--color-muted)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 6px' }}>Vista previa en card</h3>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{
              background: 'var(--color-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', gap: 4, flexShrink: 0, minWidth: 56,
            }}>
              <Receipt size={16} style={{ color: '#3B82F6', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                <span>dom</span><span>21</span>
              </span>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>Supermercado</p></div>
              <div style={{ textAlign: 'right' }}><p style={{ fontSize: 13, fontWeight: 700, color: '#10B981', margin: 0 }}>+€15.16</p></div>
            </div>
          </div>
        </div>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{
              background: 'var(--color-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', gap: 4, flexShrink: 0, minWidth: 56,
            }}>
              <ArrowLeftRight size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                <span>sáb</span><span>20</span>
              </span>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>Tester</p></div>
              <div style={{ textAlign: 'right' }}><p style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', margin: 0 }}>-€33.48</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Design/Iconos Gasto y Transferencia',
  component: IconPicker,
  tags: ['ai-generated'],
} satisfies Meta<typeof IconPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Comparativa: Story = {}
