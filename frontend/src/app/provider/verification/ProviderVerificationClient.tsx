'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { authApi, ApiError } from '@/lib/api'
import {
  VERIFICATION_LABELS,
  type ProviderVerificationStatus,
} from '@/lib/auth-types'
import { ArrowRightIcon, ClockIcon, ShieldIcon, XCircleIcon } from '@/components/ui/AuthIcons'

const statusCopy: Record<ProviderVerificationStatus, string> = {
  pending:
    'Pengajuan kamu sedang ditinjau oleh admin LOKA. Kamu belum dapat mempublikasikan layanan secara normal sampai verifikasi selesai.',
  verified:
    'Akun kamu sudah terverifikasi. Kamu dapat mempublikasikan layanan secara normal setelah fitur layanan tersedia.',
  rejected:
    'Pengajuan verifikasi belum disetujui. Baca alasan penolakan di bawah, lalu ajukan ulang setelah data kamu lengkap.',
}

const statusIcon: Record<ProviderVerificationStatus, ReactNode> = {
  pending: <ClockIcon size={24} />,
  verified: <ShieldIcon size={24} />,
  rejected: <XCircleIcon size={24} />,
}

export default function ProviderVerificationClient() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return <AuthLoadingScreen />
  }

  const status: ProviderVerificationStatus = user.providerVerificationStatus ?? 'pending'

  async function handleReapply() {
    if (submitting) return
    setSubmitting(true)

    try {
      const result = await authApi.requestProviderVerification()
      await refresh()
      toast.success(result.message)
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Tidak dapat mengirim pengajuan verifikasi. Silakan coba lagi.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell
      eyebrow="Verifikasi Penyedia Jasa"
      title="Status verifikasi akun kamu."
      description="Verifikasi membantu menjaga kepercayaan antar pengguna LOKA. Status di bawah ini berasal dari profil akun yang tersimpan di server."
    >
      <section className="dash-grid dash-grid--single">
        <article className={`dash-card dash-card--status dash-card--${status}`}>
          <div className="dash-status-head">
            <span className="dash-status-icon">{statusIcon[status]}</span>
            <div>
              <span className="dash-card__eyebrow">Status pengajuan</span>
              <h2>{VERIFICATION_LABELS[status]}</h2>
            </div>
          </div>

          <p>{statusCopy[status]}</p>

          {status === 'rejected' && (
            <div className="dash-reason">
              <strong>Alasan penolakan</strong>
              <p>
                {user.providerRejectionReason?.trim() ||
                  'Admin belum menambahkan alasan penolakan. Hubungi dukungan LOKA untuk informasi lebih lanjut.'}
              </p>
            </div>
          )}

          {status === 'rejected' && (
            <button
              type="button"
              className="auth-submit dash-action"
              onClick={() => void handleReapply()}
              disabled={submitting}
            >
              {submitting && <span className="auth-spinner" aria-hidden="true" />}
              <span>{submitting ? 'Mengirim pengajuan…' : 'Ajukan Ulang Verifikasi'}</span>
            </button>
          )}

          {status === 'verified' && (
            <Link href="/provider/dashboard" className="auth-submit auth-submit--link dash-action">
              Buka Dashboard Penyedia
              <ArrowRightIcon size={18} />
            </Link>
          )}
        </article>

        <article className="dash-card">
          <span className="dash-card__eyebrow">Yang perlu disiapkan</span>
          <h2>Data penyedia jasa</h2>
          <p>
            Pastikan profil usaha, keterampilan, dan informasi kontak kamu akurat.
            Pengelolaan portofolio dan layanan akan tersedia pada tahap pengembangan
            berikutnya.
          </p>
        </article>
      </section>
    </DashboardShell>
  )
}
