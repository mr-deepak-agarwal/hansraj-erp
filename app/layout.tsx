import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'School ERP',
  description: 'Simple school management: students, admissions, fees, attendance and marks',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
