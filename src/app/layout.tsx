import type { Metadata } from 'next'
import { Outfit, Sora } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: '027Apps',
  description: 'Group apps platform',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${sora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var t;try{t=localStorage.getItem('027-theme')}catch(e){}var d=(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)||t==='dark';if(d){document.documentElement.classList.add('dark');document.documentElement.style.backgroundColor='#12120E'}else{document.documentElement.style.backgroundColor='#F8F6F3'}})()`
        }} />
      </head>
      <body className={sora.className}>{children}</body>
    </html>
  )
}
