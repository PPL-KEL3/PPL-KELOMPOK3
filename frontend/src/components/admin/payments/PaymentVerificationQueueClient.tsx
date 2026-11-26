'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertIcon, ArrowLeftIcon, InfoIcon, RefreshIcon, ShieldIcon } from '@/components/ui/AuthIcons'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { adminPaymentApi, ApiError, type AdminPaymentData, type VerificationCaseData, verificationCaseApi } from '@/lib/api'
import { formatBookingDate } from '@/lib/booking-utils'
import { useToast } from '@/components/ui/ToastProvider'

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

export function PaymentVerificationQueueClient() {
  const [payments, setPayments] = useState<AdminPaymentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [cases, setCases] = useState<VerificationCaseData[]>([])
  const toast = useToast()

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminPaymentApi.list()
      setPayments(result.payments)
      const caseResult = await verificationCaseApi.list()
      setCases(caseResult.cases)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Antrean pembayaran gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPayments() }, [loadPayments])

  const stats = useMemo(() => ({
    total: payments.length,
    unpaid: payments.filter((payment) => payment.status === 'unpaid').length,
    paid: payments.filter((payment) => payment.status === 'paid').length,
    inactive: payments.filter((payment) => payment.status === 'unpaid' && payment.sessionStatus !== 'active').length,
  }), [payments])

  async function markPaid(payment: AdminPaymentData) {
    if (actionId || payment.status === 'paid') return
    if (!window.confirm(`Tandai pembayaran ${formatRupiah(payment.amount)} sebagai lunas?`)) return
    setActionId(payment.id)
    try {
      const result = await adminPaymentApi.markPaid(payment.id)
      setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, ...result.payment } : item))
      toast.success('Pembayaran berhasil ditandai lunas.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Status pembayaran gagal diperbarui.')
    } finally {
      setActionId(null)
    }
  }

  async function createCase(payment: AdminPaymentData) {
    const description = window.prompt('Jelaskan ketidaksesuaian pembayaran ini:')?.trim()
    if (!description) return
    try {
      const result = await verificationCaseApi.create({ paymentId: payment.id, issueType: 'other', description })
      setCases((current) => [result.case, ...current])
      toast.success('Kasus verifikasi berhasil dibuat.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Kasus gagal dibuat.')
    }
  }

  async function updateCase(item: VerificationCaseData, status: VerificationCaseData['status']) {
    const decisionNotes = window.prompt('Catatan keputusan admin:')?.trim()
    if (!decisionNotes) return
    try {
      const result = await verificationCaseApi.update(item.id, { status, decisionNotes })
      setCases((current) => current.map((currentItem) => currentItem.id === item.id ? result.case : currentItem))
      toast.success('Kasus berhasil diperbarui.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Kasus gagal diperbarui.')
    }
  }

  async function deleteCase(item: VerificationCaseData) {
    if (!window.confirm('Arsipkan kasus ini? Data transaksi dan audit log tetap disimpan.')) return
    try {
      await verificationCaseApi.remove(item.id)
      setCases((current) => current.filter((currentItem) => currentItem.id !== item.id))
      toast.success('Kasus berhasil diarsipkan.')
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Kasus gagal diarsipkan.')
    }
  }

  return (
    <DashboardShell eyebrow="Pembayaran" title="Antrean Verifikasi Pembayaran" description="Periksa pembayaran QRIS yang masuk dan tandai lunas setelah bukti pembayaran customer terkonfirmasi.">
      <div className="verification-workspace">
        <div className="verification-breadcrumb">
          <Link href="/admin/dashboard" className="verification-back-link"><ArrowLeftIcon size={16} /><span>Kembali ke Dashboard Admin</span></Link>
          <span aria-current="page">Dashboard / Pembayaran / Verifikasi</span>
        </div>

        <section className="verification-stats" aria-label="Ringkasan pembayaran">
          <StatCard label="Total Pembayaran" value={loading ? '—' : String(stats.total)} />
          <StatCard label="Menunggu Verifikasi" value={loading ? '—' : String(stats.unpaid)} tone="warning" />
          <StatCard label="Sudah Lunas" value={loading ? '—' : String(stats.paid)} tone="success" />
          <StatCard label="Sesi Tidak Aktif" value={loading ? '—' : String(stats.inactive)} tone="muted" />
        </section>

        <section className="verification-card" aria-labelledby="verification-queue-title">
          <div className="verification-card__header">
            <div><span className="dash-card__eyebrow">Kontrol pembayaran</span><h2 id="verification-queue-title">Daftar Pembayaran Customer</h2><p>Data diurutkan dari pembayaran terbaru.</p></div>
            <button type="button" className="verification-refresh-button" onClick={() => void loadPayments()} disabled={loading}><RefreshIcon size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}</button>
          </div>

          {loading && <div className="verification-empty-state"><span className="auth-spinner auth-spinner--large" /><h3>Memuat data pembayaran...</h3></div>}
          {!loading && error && <div className="verification-notice verification-notice--error" role="alert"><AlertIcon size={18} /><div><strong>Antrean gagal dimuat</strong><p>{error}</p><button type="button" onClick={() => void loadPayments()}>Coba lagi</button></div></div>}
          {!loading && !error && payments.length === 0 && <div className="verification-empty-state"><span className="verification-empty-state__icon"><ShieldIcon size={30} /></span><h3>Belum ada pembayaran</h3><p>Pembayaran akan muncul setelah customer membuka halaman QRIS dari booking yang sudah diterima provider.</p></div>}
          {!loading && !error && payments.length > 0 && <div className="verification-payment-list">{payments.map((payment) => <PaymentRow key={payment.id} payment={payment} actionId={actionId} onMarkPaid={() => void markPaid(payment)} onCreateCase={() => void createCase(payment)} />)}</div>}
        </section>

        {!loading && !error && <section className="verification-card" aria-labelledby="verification-cases-title">
          <div className="verification-card__header"><div><span className="dash-card__eyebrow">CRUD kasus</span><h2 id="verification-cases-title">Kasus Verifikasi Aktif</h2><p>Kasus dapat dibuat, dibaca, diperbarui, dan diarsipkan tanpa menghapus transaksi atau audit log.</p></div></div>
          {cases.length === 0 ? <div className="verification-empty-state"><h3>Belum ada kasus verifikasi</h3><p>Gunakan tombol “Buat Kasus” pada pembayaran yang membutuhkan pemeriksaan.</p></div> : <div className="verification-case-list">{cases.map((item) => <article className="verification-case-row" key={item.id}><div><span>Kasus #{item.id.slice(0, 8)}</span><strong>{item.description}</strong><small>Payment #{item.paymentId.slice(0, 8)}</small></div><select value={item.status} disabled={item.status === 'closed'} onChange={(event) => void updateCase(item, event.target.value as VerificationCaseData['status'])}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="duplicate">Duplicate</option><option value="closed">Closed</option></select><button type="button" onClick={() => void deleteCase(item)} disabled={item.status === 'closed'}>Arsipkan</button></article>)}</div>}
        </section>}

        <section className="verification-scope-note" aria-label="Informasi verifikasi"><InfoIcon size={16} /><span>Admin hanya menandai pembayaran lunas setelah transfer customer berhasil dikonfirmasi. Status booking tetap dikelola oleh provider.</span></section>
      </div>
    </DashboardShell>
  )
}

function PaymentRow({ payment, actionId, onMarkPaid, onCreateCase }: { payment: AdminPaymentData; actionId: string | null; onMarkPaid: () => void; onCreateCase: () => void }) {
  const booking = payment.booking
  return <article className="verification-payment-row">
    <div><span className="verification-payment-row__label">Customer</span><strong>{booking?.customerName ?? 'Customer LOKA'}</strong><small>{booking?.customerEmail || `Payment #${payment.id.slice(0, 8)}`}</small></div>
    <div><span className="verification-payment-row__label">Booking / jasa</span><strong>#{payment.bookingId.slice(0, 8)}</strong><small>{booking?.serviceName ?? 'Jasa LOKA'}</small></div>
    <div><span className="verification-payment-row__label">Nominal</span><strong>{formatRupiah(payment.amount)}</strong><small>{booking ? `${formatBookingDate(booking.workDate)} · ${booking.workTime}` : '—'}</small></div>
    <div><span className="verification-payment-row__label">Status</span><span className={`verification-payment-status verification-payment-status--${payment.status}`}>{payment.status === 'paid' ? 'Lunas' : payment.sessionStatus === 'active' ? 'Menunggu verifikasi' : 'Sesi tidak aktif'}</span></div>
    <div className="verification-payment-actions">{payment.status === 'unpaid' && payment.sessionStatus === 'active' && <button type="button" className="verification-paid-button" disabled={actionId !== null} onClick={onMarkPaid}>{actionId === payment.id ? 'Memproses...' : 'Tandai Lunas'}</button>}<button type="button" className="verification-case-button" onClick={onCreateCase}>Buat Kasus</button></div>
  </article>
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: string }) {
  return <article className={`verification-stat verification-stat--${tone}`}><span>{label}</span><strong>{value}</strong><small>{value === '—' ? 'Memuat...' : 'Data aktual'}</small></article>
}
