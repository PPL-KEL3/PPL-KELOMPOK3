'use client'

import Link from 'next/link'
import { formatRupiah } from '@/data/mock-services'
import { useServices } from '@/hooks/useServices'

export function PublishedServicesCatalog() {
  const { publicServices, loading } = useServices()

  if (loading) {
    return (
      <article className="dash-card">
        <span className="dash-card__eyebrow">Direktori Jasa LOKA</span>
        <h2>Memuat layanan jasa aktif...</h2>
      </article>
    )
  }

  return (
    <section
      className="dash-card"
      style={{ marginTop: '18px' }}
      aria-labelledby="customer-published-services-heading"
    >
      <span className="dash-card__eyebrow">
        Direktori Layanan Terpublikasi ({publicServices.length} Jasa Aktif)
      </span>
      <h2 id="customer-published-services-heading">
        Layanan Jasa Lokal Tersedia
      </h2>
      <p>
        Daftar layanan di bawah ini merupakan jasa yang telah dipublikasikan oleh
        penyedia jasa terverifikasi di LOKA.
      </p>

      <div className="dash-grid" style={{ marginTop: '16px' }}>
        {publicServices.map((service) => (
          <article key={service.id} className="dash-card">
            <span className="dash-card__eyebrow">{service.categoryName}</span>
            <h2>{service.name}</h2>
            <p>{service.description}</p>
            <p className="catalog-provider">
              Oleh {service.providerName?.trim() || 'Penyedia Jasa LOKA'}
            </p>
            <div className="catalog-service-footer">
              <strong>Mulai {formatRupiah(service.price)}</strong>
              <Link
                href={`/providers/${service.providerId}`}
                className="catalog-profile-link"
              >
                Lihat Profil
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
