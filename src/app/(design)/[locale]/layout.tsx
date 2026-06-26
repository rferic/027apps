'use client'

import { useState } from 'react'

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (typeof window !== 'undefined' ? localStorage.getItem('design-theme') as 'light' | 'dark' : null) || 'light'
  )

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('design-theme', next)
  }

  return (
    <div className={theme}>
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-50 size-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform text-sm"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      {children}
    </div>
  )
}
