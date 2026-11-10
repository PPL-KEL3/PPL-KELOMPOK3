import type { Metadata } from 'next'
import ForgotPasswordClient from './ForgotPasswordClient'

export const metadata: Metadata = {
  title: 'Lupa Password — LOKA',
  description: 'Atur ulang password akun LOKA kamu melalui email.',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />
}
