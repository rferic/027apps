'use client'

import { Menu } from 'lucide-react'
import { useAdminMobile } from './admin-mobile-context'

export function HamburgerButton() {
  const { setMobileOpen } = useAdminMobile()

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Open menu"
    >
      <Menu size={18} />
    </button>
  )
}
