import Link from 'next/link'
import { formatRupiah } from '@/lib/package-utils'
import type { PackageItem } from '@/types/package'

interface PackageListProps {
  packages: PackageItem[]
  // Target tombol "Pilih paket ini". Pemesanan (PBI-13) belum ada, jadi default ke halaman masuk.
  selectHref?: string
}

// Daftar paket publik. Dipakai di /preview sekarang, dan di halaman detail jasa permanen nanti.
export function PackageList({ packages, selectHref = '/login' }: PackageListProps) {
  return (
    <div className="pkgpub-grid">
      {packages.map((item) => (
        <article key={item.id} className="pkgpub-card">
          <h3>{item.name}</h3>
          {item.description && <p className="pkgpub-card__desc">{item.description}</p>}
          <p className="pkgpub-card__price">{formatRupiah(item.price)}</p>
          <Link href={selectHref} className="pkgpub-card__cta">
            Pilih paket ini
          </Link>
        </article>
      ))}
    </div>
  )
}
