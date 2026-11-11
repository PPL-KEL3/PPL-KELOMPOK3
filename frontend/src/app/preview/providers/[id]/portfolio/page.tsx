import type { Metadata } from 'next'
import { PublicPortfolioPreviewClient } from '@/components/portfolio/PublicPortfolioPreviewClient'
// Navigasi, banner, hero, dan state publik memakai gaya pratinjau TPR-5 (design system LOKA v2).
import '../../../services/[id]/packages/preview.css'

export const metadata: Metadata = {
  title: 'Portofolio Penyedia Jasa - LOKA',
  description: 'Lihat contoh hasil pekerjaan penyedia jasa lokal di LOKA.',
}

// Halaman demo AC2 TPR-6. Galeri yang sama dipasang di /providers/[id] pada v1.1.
export default async function PreviewProviderPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PublicPortfolioPreviewClient providerId={id} />
}
