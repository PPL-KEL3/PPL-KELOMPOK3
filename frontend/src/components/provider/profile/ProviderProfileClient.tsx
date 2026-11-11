'use client'

import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { useToast } from '@/components/ui/ToastProvider'
import { ArrowLeftIcon, InfoIcon, RefreshIcon } from '@/components/ui/AuthIcons'
import { useProviderProfile } from '@/hooks/useProviderProfile'
import type { ProviderProfileFormInput } from '@/types/provider'
import { ExternalLinkIcon } from './ProfileIcons'
import { ProviderProfileForm } from './ProviderProfileForm'
import { ServiceAreasCard } from './ServiceAreasCard'

export function ProviderProfileClient() {
  const toast = useToast()
  const {
    profile,
    categories,
    categoriesError,
    loading,
    saving,
    error,
    saveProfile,
    reload,
  } = useProviderProfile()

  const statusLabel = !profile
    ? 'Profil belum dibuat'
    : profile.isPublic
      ? 'Profil publik aktif'
      : 'Belum dipublikasikan'

  async function handleSubmit(input: ProviderProfileFormInput) {
    const result = await saveProfile(input)
    if (result.ok) {
      toast.success(result.message)
    }
    return result
  }

  return (
    <DashboardShell
      eyebrow="Dashboard Penyedia Jasa"
      title="Profil Penyedia Jasa"
      description="Lengkapi identitas usaha, kontak WhatsApp, alamat, area layanan, kategori utama, dan jam operasional agar pelanggan dapat mengenal dan menghubungi kamu."
    >
      <div className="prf-workspace">
        <div className="prf-topbar">
          <Link href="/provider/dashboard" className="prf-back-link">
            <ArrowLeftIcon size={16} />
            <span>Kembali ke Dashboard Penyedia</span>
          </Link>

          <div className="prf-topbar__actions">
            <span
              className={`prf-status-pill ${
                profile?.isPublic
                  ? 'prf-status-pill--public'
                  : 'prf-status-pill--hidden'
              }`}
            >
              {statusLabel}
            </span>

            {profile?.isPublic && (
              <Link
                href={`/providers/${profile.id}`}
                className="prf-public-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Lihat Profil Publik</span>
                <ExternalLinkIcon size={15} />
              </Link>
            )}
          </div>
        </div>

        <section className="dash-card prf-section-card">
          <div className="prf-page-header">
            <div>
              <span className="dash-card__eyebrow">Identitas Usaha</span>
              <h2>Informasi Profil Penyedia</h2>
              <p>
                Semua field bertanda wajib harus diisi. Profil yang sudah tersimpan
                dapat langsung ditampilkan ke publik melalui tombol switch di bawah.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="prf-state-panel" role="status" aria-live="polite">
              <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
              <div>
                <h3>Memuat profil penyedia...</h3>
                <p>Mohon tunggu sebentar sementara data profil disiapkan.</p>
              </div>
            </div>
          ) : error ? (
            <div className="prf-state-panel prf-state-panel--error" role="alert">
              <AuthAlert tone="error">{error}</AuthAlert>
              <button
                type="button"
                className="prf-btn prf-btn--secondary"
                onClick={() => void reload()}
              >
                <RefreshIcon size={16} />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            <>
              {!profile && (
                <AuthAlert tone="info">
                  Profil kamu belum dibuat. Lengkapi formulir di bawah ini lalu
                  simpan untuk mulai mengelola profil penyedia.
                </AuthAlert>
              )}

              <div className="prf-note">
                <InfoIcon size={16} />
                <span>
                  Nomor WhatsApp akan terlihat oleh pelanggan ketika profil
                  dipublikasikan. Pastikan nomor aktif dan benar.
                </span>
              </div>

              <ProviderProfileForm
                initialProfile={profile}
                categories={categories}
                categoriesError={categoriesError}
                submitting={saving}
                onSubmit={handleSubmit}
              />
            </>
          )}
        </section>

        {profile && <ServiceAreasCard />}
      </div>
    </DashboardShell>
  )
}
