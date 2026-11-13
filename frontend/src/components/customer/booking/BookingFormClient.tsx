'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon, ArrowLeftIcon, CheckCircleIcon, ClockIcon, InfoIcon, PackageIcon } from '@/components/ui/AuthIcons'
import { ApiError, bookingApi, packageApi, providerProfileApi, serviceApi } from '@/lib/api'
import { deriveHourlySlots, formatBookingDate, getWorkHours, todayInputValue } from '@/lib/booking-utils'
import type { PackageItem } from '@/types/package'
import type { ProviderProfile } from '@/types/provider'
import type { ServiceItem } from '@/types/service'
import type { BookingDraft } from '@/types/booking'
import type { BookingRequirementsValue } from '@/types/booking-requirements'
import { BookingRequirementsForm } from './BookingRequirementsForm'
import { formatRupiah } from '@/data/mock-services'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; service: ServiceItem; provider: ProviderProfile; packages: PackageItem[] }
  | { status: 'error'; message: string }

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

export function BookingFormClient({ serviceId }: { serviceId: string }) {
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [draft, setDraft] = useState<BookingDraft>({ serviceId, providerId: '', packageId: '', workDate: '', workTime: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<BookingRequirementsValue>({ notes: '', files: [] })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState({ status: 'loading' })
      try {
        const serviceResult = await serviceApi.getById(serviceId)
        const [providerResult, packagesResult] = await Promise.all([
          providerProfileApi.getPublic(serviceResult.service.providerId),
          packageApi.listByService(serviceId).catch(() => ({ packages: [] })),
        ])
        if (!cancelled) {
          setDraft((current) => ({ ...current, providerId: providerResult.provider.id }))
          setState({ status: 'ready', service: serviceResult.service, provider: providerResult.provider, packages: packagesResult.packages })
        }
      } catch (error) {
        if (cancelled) return
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Jasa tidak dapat dimuat. Silakan coba lagi.' })
      }
    }
    if (serviceId) void load()
    else setState({ status: 'error', message: 'ID jasa tidak tersedia.' })
    return () => { cancelled = true }
  }, [serviceId])

  const slots = useMemo(() => state.status === 'ready' && draft.workDate ? deriveHourlySlots(draft.workDate, state.provider.operatingHours) : [], [draft.workDate, state])

  function changeDate(value: string) {
    setDraft((current) => ({ ...current, workDate: value, workTime: '' }))
    setDateError(value && state.status === 'ready' && !getWorkHours(value, state.provider.operatingHours) ? 'Penyedia tidak beroperasi pada tanggal tersebut. Pilih tanggal lain.' : null)
    setSubmitError(null)
  }

  async function submit() {
    if (state.status !== 'ready' || submitting) return
    if (!draft.workDate || !draft.workTime) {
      setSubmitError('Pilih tanggal dan waktu pengerjaan terlebih dahulu.')
      return
    }
    if (requirements.notes.trim() || requirements.files.length > 0) {
      setSubmitError('Detail kebutuhan belum dapat disimpan karena endpoint requirements TPR-78 belum tersedia. Hapus catatan dan foto atau tunggu integrasi backend.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await bookingApi.create(draft)
      router.push(`/customer/booking/${result.booking.id}`)
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Booking gagal disimpan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'loading') return <BookingState title="Memuat informasi jasa..." text="Mohon tunggu sebentar." loading />
  if (state.status === 'error') return <BookingState title="Booking tidak dapat dibuat" text={state.message} />

  const { service, provider, packages } = state
  const selectedPackage = packages.find((item) => item.id === draft.packageId) ?? null
  const selectedPrice = selectedPackage?.price ?? service.price
  const canSubmit = Boolean(draft.workDate && draft.workTime && !dateError && !submitting)

  return (
    <main className="booking-page">
      <div className="booking-page__inner">
        <Link href={`/providers/${provider.id}`} className="booking-back"><ArrowLeftIcon size={16} /> Kembali ke profil penyedia</Link>
        <header className="booking-page__hero"><span className="booking-eyebrow">Pemesanan Jasa</span><h1>Buat Pemesanan Jasa</h1><p>Lengkapi informasi pemesanan dan pilih jadwal yang sesuai dengan ketersediaan penyedia jasa.</p></header>

        <div className="booking-layout">
          <div className="booking-main-column">
            <section className="booking-card" aria-labelledby="booking-service-title">
              <div className="booking-card__heading"><span className="booking-icon"><PackageIcon size={19} /></span><div><span className="booking-eyebrow">Jasa yang dipilih</span><h2 id="booking-service-title">Ringkasan Jasa</h2></div></div>
              <div className="booking-service-summary"><span className="booking-service-summary__avatar">{initials(provider.businessName) || 'LK'}</span><div><strong>{service.name}</strong><span>{service.categoryName} · {provider.businessName}</span><small>{service.description}</small></div><b>{formatRupiah(selectedPrice)}</b></div>
            </section>

            <section className="booking-card" aria-labelledby="booking-schedule-title">
              <div className="booking-card__heading"><span className="booking-icon"><ClockIcon size={19} /></span><div><span className="booking-eyebrow">Jadwal pengerjaan</span><h2 id="booking-schedule-title">Pilih Tanggal Pengerjaan</h2></div></div>
              <label className="booking-label" htmlFor="booking-date">Tanggal pengerjaan</label>
              <input id="booking-date" className="booking-date-input" type="date" min={todayInputValue()} value={draft.workDate} onChange={(event) => changeDate(event.target.value)} />
              {dateError && <p className="booking-error" role="alert"><AlertIcon size={15} />{dateError}</p>}
              <p className="booking-helper">Tanggal yang dapat dipilih mengikuti jam operasional penyedia jasa.</p>
              <h3 className="booking-subheading">Pilih Waktu Pengerjaan</h3>
              {draft.workDate && slots.length === 0 && !dateError && <div className="booking-empty"><InfoIcon size={17} /><span>Tidak ada slot waktu dari jam operasional pada tanggal ini.</span></div>}
              <div className="booking-slots" role="radiogroup" aria-label="Slot waktu pengerjaan">
                {slots.map((slot) => <button type="button" key={slot} className={`booking-slot${draft.workTime === slot ? ' is-selected' : ''}`} aria-pressed={draft.workTime === slot} onClick={() => { setDraft((current) => ({ ...current, workTime: slot })); setSubmitError(null) }}>{slot}</button>)}
              </div>
            </section>

            {packages.length > 0 && <section className="booking-card" aria-labelledby="booking-package-title"><div className="booking-card__heading"><span className="booking-icon"><PackageIcon size={19} /></span><div><span className="booking-eyebrow">Pilihan tambahan</span><h2 id="booking-package-title">Pilih Paket</h2></div></div><div className="booking-packages">{packages.map((item) => <button type="button" key={item.id} className={`booking-package${draft.packageId === item.id ? ' is-selected' : ''}`} onClick={() => setDraft((current) => ({ ...current, packageId: item.id }))}><span><strong>{item.name}</strong><small>{item.description || 'Paket layanan dari penyedia jasa.'}</small></span><b>{formatRupiah(item.price)}</b></button>)}</div></section>}
            <BookingRequirementsForm value={requirements} onChange={setRequirements} />
          </div>

          <aside className="booking-summary" aria-labelledby="booking-summary-title"><div className="booking-summary__top"><span className="booking-eyebrow">Periksa kembali</span><h2 id="booking-summary-title">Ringkasan Pemesanan</h2></div><dl><div><dt>Jasa</dt><dd>{service.name}</dd></div><div><dt>Penyedia</dt><dd>{provider.businessName}</dd></div><div><dt>Tanggal</dt><dd>{formatBookingDate(draft.workDate)}</dd></div><div><dt>Waktu</dt><dd>{draft.workTime || 'Belum dipilih'}</dd></div><div><dt>Harga</dt><dd>{formatRupiah(selectedPrice)}</dd></div></dl>{submitError && <p className="booking-error" role="alert"><AlertIcon size={15} />{submitError}</p>}<button type="button" className="booking-submit" disabled={!canSubmit} onClick={() => void submit()}>{submitting ? 'Memproses...' : 'Konfirmasi Booking'}</button><p className="booking-summary__note"><InfoIcon size={14} />Konfirmasi belum dikirim ke penyedia sampai proses penyimpanan berhasil.</p></aside>
        </div>
      </div>
    </main>
  )
}

function BookingState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return <main className="booking-page"><div className="booking-state" role={loading ? 'status' : 'alert'}>{loading && <span className="auth-spinner auth-spinner--large" aria-hidden="true" />}<h1>{title}</h1><p>{text}</p><Link href="/customer/dashboard" className="booking-secondary">Kembali ke dashboard</Link></div></main>
}
