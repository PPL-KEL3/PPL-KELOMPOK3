import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LOKA — Direktori Jasa Lokal',
  description: 'Platform yang menghubungkan masyarakat dengan penyedia jasa lokal untuk membuka peluang penghasilan dan mendukung SDG 1.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
