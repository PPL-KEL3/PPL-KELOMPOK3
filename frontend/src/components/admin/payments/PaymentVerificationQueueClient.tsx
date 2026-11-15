'use client'

import Link from 'next/link'
import { ArrowLeftIcon, InfoIcon, ShieldIcon } from '@/components/ui/AuthIcons'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export function PaymentVerificationQueueClient() {
  return (
    <DashboardShell
      eyebrow="Pembayaran"
      title="Antrean Verifikasi Pembayaran"
      description="Pantau dan periksa transaksi yang membutuhkan penanganan akibat ketidaksesuaian pembayaran."
    >
      <div className="verification-workspace">
        <div className="verification-breadcrumb">
          <Link href="/admin/dashboard" className="verification-back-link">
            <ArrowLeftIcon size={16} />
            <span>Kembali ke Dashboard Admin</span>
          </Link>
          <span aria-current="page">Dashboard / Pembayaran / Antrean Verifikasi</span>
        </div>

        <section className="verification-stats" aria-label="Ringkasan antrean verifikasi">
          <StatCard label="Total Kasus" value="—" />
          <StatCard label="Menunggu Pemeriksaan" value="—" tone="warning" />
          <StatCard label="Sedang Diperiksa" value="—" tone="info" />
          <StatCard label="Selesai" value="—" tone="success" />
          <StatCard label="Kasus Duplikat" value="—" tone="muted" />
        </section>

        <section className="verification-card" aria-labelledby="verification-queue-title">
          <div className="verification-card__header">
            <div>
              <span className="dash-card__eyebrow">Kontrol Pengecualian Pembayaran</span>
              <h2 id="verification-queue-title">Daftar Kasus Verifikasi</h2>
              <p>Kasus akan muncul setelah backend menyediakan data antrean pemeriksaan pembayaran.</p>
            </div>
            <span className="verification-dependency-badge">Menunggu TPR-110</span>
          </div>

          <div className="verification-notice" role="status">
            <InfoIcon size={18} />
            <div>
              <strong>Antrean belum tersedia</strong>
              <p>
                Backend saat ini belum memiliki endpoint daftar kasus verifikasi,
                tabel kasus, atau audit log pembayaran. Halaman ini tidak
                menggunakan data dummy dan tidak dapat menampilkan transaksi
                sebelum kontrak TPR-110 tersedia.
              </p>
            </div>
          </div>

          <div className="verification-empty-state">
            <span className="verification-empty-state__icon" aria-hidden="true">
              <ShieldIcon size={30} />
            </span>
            <h3>Belum ada data untuk ditampilkan</h3>
            <p>
              Setelah endpoint antrean tersedia, bagian ini akan menampilkan
              ID kasus, transaksi, booking, nominal, status, jenis
              ketidaksesuaian, tanggal, dan detail kasus.
            </p>
          </div>
        </section>

        <section className="verification-scope-note" aria-label="Batasan akses">
          <InfoIcon size={16} />
          <span>
            Halaman ini hanya dapat dibuka oleh Admin melalui proteksi role
            dashboard. Tidak tersedia aksi untuk mengubah status lunas atau
            menghapus transaksi.
          </span>
        </section>
      </div>
    </DashboardShell>
  )
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: string }) {
  return (
    <article className={`verification-stat verification-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Belum tersedia</small>
    </article>
  )
}
