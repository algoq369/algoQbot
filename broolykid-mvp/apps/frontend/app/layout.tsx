import { ClientLayout } from '@/components/ClientLayout'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BROOLYKID - Sovereign Communities',
  description: 'Infrastructure for autonomous communities',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
