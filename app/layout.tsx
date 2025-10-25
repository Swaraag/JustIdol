import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Karaoke App - Real-time Pitch Analysis',
  description: 'Upload backing tracks and sing along with real-time pitch analysis and scoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-karaoke-bg">
          {children}
        </div>
      </body>
    </html>
  )
}
