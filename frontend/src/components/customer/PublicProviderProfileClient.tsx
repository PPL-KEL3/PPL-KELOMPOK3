'use client'

import Link from 'next/link'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { ClockIcon } from '@/components/ui/AuthIcons'
import { formatOperatingHours } from '@/lib/operating-hours'
import { buildWhatsAppUrl, formatWhatsAppDisplay } from '@/lib/whatsapp'
import { formatRupiah } from '@/data/mock-services'
import { usePublicProvider } from '@/hooks/usePublicProvider'
import { MapPinIcon, StoreIcon, WhatsAppIcon } from '@/components/provider/profile/ProfileIcons'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

interface PublicProviderProfileClientProps {
  providerId: string
}

export function PublicProviderProfileClient({
  providerId,
}: PublicProviderProfileClientProps) {
  const { provider, services, loading, notFound, error, reload } =
    usePublicProvider(providerId)

  if (loading) {
    return (
      <div className="pub-page">
        <PublicHeader />
        <main className="pub-main">
          <div className="pub-state" role="status" aria-live="polite">
            <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
            <h1>Memuat profil penyedia...</h1>
            <p>Mohon tunggu sebentar.</p>
          </div>
        </main>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="pub-page">
        <PublicHeader />
        <main className="pub-main">
          <div className="pub-state pub-state--empty">
            <span className="pub-state__icon" aria-hidden="true">
              <StoreIcon size={28} />
            </span>
            <h1>Profil belum tersedia</h1>
            <p>
              Profil penyedia ini belum dipublikasikan atau sudah disembunyikan.
              Silakan kembali ke direktori layanan LOKA.
            </p>
            <Link href="/" className="pub-btn pub-btn--primary">
              Kembali ke Beranda
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (error || !provider) {
    return (
      <div className="pub-page">
        <PublicHeader />
        <main className="pub-main">
          <div className="pub-state pub-state--error" role="alert">
            <h1>Gagal memuat profil</h1>
            <p>{error ?? 'Terjadi kesalahan yang tidak diketahui.'}</p>
            <button
              type="button"
              className="pub-btn pub-btn--primary"
              onClick={() => void reload()}
            >
              Coba Lagi
            </button>
          </div>
        </main>
      </div>
    )
  }

  const hours = formatOperatingHours(provider.operatingHours)
  const displayName = provider.businessName

  return (
    <div className="pub-page">
      <PublicHeader />

      <main className="pub-main">
        <section className="pub-hero" aria-labelledby="provider-profile-heading">
          <span className="pub-hero__ring" aria-hidden="true" />

          <div className="pub-hero__identity">
            <span className="pub-hero__avatar" aria-hidden="true">
              {initials(displayName) || 'LK'}
            </span>
            <div>
              <span className="pub-hero__eyebrow">Profil Penyedia Jasa Lokal</span>
              <h1 id="provider-profile-heading">{displayName}</h1>
              <span className="pub-hero__category">
                <StoreIcon size={15} />
                {provider.primaryCategory.name}
              </span>
            </div>
          </div>

          {provider.bio?.trim() && <p className="pub-hero__bio">{provider.bio}</p>}

          <div className="pub-hero__meta">
            <div>
              <MapPinIcon size={17} />
              <span>
                <strong>Area layanan</strong>
                {provider.serviceArea}
              </span>
            </div>
            <div>
              <MapPinIcon size={17} />
              <span>
                <strong>Alamat usaha</strong>
                {provider.address}
              </span>
            </div>
          </div>

          <a
            className="pub-whatsapp-cta"
            href={buildWhatsAppUrl(
              provider.whatsappNumber,
              `Halo ${displayName}, saya melihat profil usaha Anda di LOKA.`
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon size={20} />
            <span>Hubungi via WhatsApp</span>
            <small>{formatWhatsAppDisplay(provider.whatsappNumber)}</small>
          </a>
        </section>

        <section className="pub-hours-card" aria-labelledby="provider-hours-heading">
          <div className="pub-section-head">
            <div>
              <span className="pub-eyebrow">Waktu Operasional</span>
              <h2 id="provider-hours-heading">Jam Buka Usaha</h2>
            </div>
            <span className="pub-hours-icon" aria-hidden="true">
              <ClockIcon size={20} />
            </span>
          </div>

          <ul className="pub-hours-list">
            {hours.map((item) => (
              <li
                key={item.day}
                className={item.text === 'Tutup' ? 'is-closed' : undefined}
              >
                <span>{item.label}</span>
                <strong>{item.text}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="pub-services" aria-labelledby="provider-services-heading">
          <div className="pub-section-head">
            <div>
              <span className="pub-eyebrow">Layanan Tersedia</span>
              <h2 id="provider-services-heading">Layanan yang Ditawarkan</h2>
              <p>
                Daftar layanan aktif dari {displayName}. Hubungi penyedia melalui
                WhatsApp untuk informasi lebih lanjut.
              </p>
            </div>
            <span className="pub-count-badge">{services.length} Layanan</span>
          </div>

          {services.length === 0 ? (
            <div className="pub-state pub-state--inline">
              <span className="pub-state__icon" aria-hidden="true">
                <StoreIcon size={24} />
              </span>
              <h3>Belum ada layanan aktif</h3>
              <p>
                Penyedia ini belum menambahkan layanan yang dipublikasikan saat ini.
              </p>
            </div>
          ) : (
            <div className="pub-service-grid">
              {services.map((service) => (
                <article className="pub-service-card" key={service.id}>
                  <span className="pub-service-card__category">
                    {service.categoryName}
                  </span>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <div className="pub-service-card__footer">
                    <strong>{formatRupiah(service.price)}</strong>
                    <a
                      className="pub-service-card__link"
                      href={buildWhatsAppUrl(
                        provider.whatsappNumber,
                        `Halo ${displayName}, saya ingin bertanya tentang layanan "${service.name}" di LOKA.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <WhatsAppIcon size={16} />
                      <span>Tanya Layanan</span>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pub-footer">
        <p>© {new Date().getFullYear()} LOKA. Tumbuh bersama potensi lokal.</p>
        <Link href="/">Kembali ke beranda</Link>
      </footer>
    </div>
  )
}
