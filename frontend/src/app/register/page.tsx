import type { Metadata } from 'next'
import RegisterClient from './RegisterClient'

export const metadata: Metadata = {
  title: 'Daftar — LOKA',
  description: 'Buat akun Customer atau Penyedia Jasa LOKA.',
}

export default function RegisterPage() {
  return <RegisterClient />
}
