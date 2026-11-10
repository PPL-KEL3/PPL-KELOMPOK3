import type { Metadata } from 'next'
import LoginClient from './LoginClient'

export const metadata: Metadata = {
  title: 'Masuk — LOKA',
  description: 'Masuk ke akun LOKA kamu untuk melanjutkan aktivitas.',
}

export default function LoginPage() {
  return <LoginClient />
}
