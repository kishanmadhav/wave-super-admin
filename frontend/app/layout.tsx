import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wave Super Admin',
  description: 'Platform operator console for Wave.',
}

export const viewport: Viewport = {
  themeColor: '#0a0a1a',
  userScalable: true,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: 'bg-card text-card-foreground border-border !z-[100]',
          }}
        />
      </body>
    </html>
  )
}
