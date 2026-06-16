import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsModal } from './modal'

describe('DsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DsModal open={false} onClose={() => {}}>Content</DsModal>)
    expect(container.innerHTML).toBe('')
  })

  it('renders content when open', () => {
    render(<DsModal open={true} onClose={() => {}}>Content</DsModal>)
    expect(screen.getByText('Content')).toBeDefined()
  })

  it('renders title when provided', () => {
    render(<DsModal open={true} onClose={() => {}} title="My Modal">Body</DsModal>)
    expect(screen.getByText('My Modal')).toBeDefined()
  })

  it('has dialog role and aria-modal', () => {
    render(<DsModal open={true} onClose={() => {}}>Content</DsModal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders close button', () => {
    render(<DsModal open={true} onClose={() => {}}>Content</DsModal>)
    expect(screen.getByLabelText('Close')).toBeDefined()
  })
})
