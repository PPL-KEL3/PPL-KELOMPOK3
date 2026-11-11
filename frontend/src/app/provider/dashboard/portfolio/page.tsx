import type { Metadata } from 'next'
import { PortfolioManagementClient } from '@/components/provider/portfolio/PortfolioManagementClient'
// Tombol, kartu, modal, dan state memakai kelas bersama dari halaman Paket & Harga (design system LOKA v2).
import '../packages/packages.css'
import './portfolio.css'

export const metadata: Metadata = {
  title: 'Portofolio Pekerjaan - Penyedia LOKA',
  description: 'Kelola foto hasil pekerjaan yang tampil di profil publik penyedia jasa LOKA.',
}

export default function ProviderPortfolioPage() {
  return <PortfolioManagementClient />
}
