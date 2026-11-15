'use client'

import Link from 'next/link'
import { formatRupiah } from '@/data/mock-services'
import { useServices } from '@/hooks/useServices'
import { useFavorites } from '@/hooks/useFavorites'
import { HeartIcon } from '@/components/ui/AuthIcons'

export function PublishedServicesCatalog() {
  const { publicServices, loading } = useServices()
  const { isFavorite, getFavoriteByTarget, addFavorite, removeFavorite } = useFavorites('service')

  async function handleToggleFavorite(serviceId: string) {
    const existing = getFavoriteByTarget('service', serviceId)
    if (existing) {
      await removeFavorite(existing.id)
    } else {
      await addFavorite({ itemType: 'service', serviceId })
    }
  }

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
      id="catalog"
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
        {publicServices.map((service) => {
          const favorited = isFavorite('service', service.id)
          return (
            <article key={service.id} className="dash-card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="dash-card__eyebrow">{service.categoryName}</span>
                <button
                  type="button"
                  onClick={() => void handleToggleFavorite(service.id)}
                  title={favorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                  aria-label={favorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: favorited ? '#ef4444' : '#94a3b8',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HeartIcon size={20} filled={favorited} />
                </button>
              </div>
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
                <Link
                  href={`/customer/booking/new?serviceId=${encodeURIComponent(service.id)}`}
                  className="catalog-profile-link"
                >
                  Booking Sekarang
                </Link>
            </div>
          </article>
        )})}
      </div>
    </section>
  )
}
