import type { Metadata } from 'next'
import ResetPasswordClient from './ResetPasswordClient'

export const metadata: Metadata = {
  title: 'Atur Password Baru — LOKA',
  description: 'Atur ulang password akun LOKA kamu.',
}

export default function ResetPasswordPage() {
  return <ResetPasswordClient />
}
