import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GIIS Hackathon 2K26',
  description: 'The official hackathon portal for GIIS Hackathon 2K26 — July 31 & August 1, 2026. Register your team, submit your project, and compete for glory.',
  keywords: ['GIIS', 'hackathon', '2026', 'coding', 'tech', 'Singapore'],
  openGraph: {
    title: 'GIIS Hackathon 2K26',
    description: 'Register, build, and compete. July 31 – August 1, 2026.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
