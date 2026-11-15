'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import {
  AlertIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  PackageIcon,
  RefreshIcon,
  XCircleIcon,
} from '@/components/ui/AuthIcons'
import { useToast } from '@/components/ui/ToastProvider'
import { PlusIcon } from '@/components/provider/services/ServiceIcons'
import { usePackages } from '@/hooks/usePackages'
import { isPackageLimitReached } from '@/lib/package-utils'
import {
  MAX_PACKAGES_PER_SERVICE,
  type PackageFilter,
  type PackageFormInput,
  type PackageItem,
} from '@/types/package'
import { DeletePackageDialog } from './DeletePackageDialog'
import { PackageCard } from './PackageCard'
import { PackageFormModal, type PackageModalMode } from './PackageFormModal'

const FILTERS: { value: PackageFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
]

export function PackageManagementClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()
  const urlServiceId = searchParams.get('serviceId')

  const [resolvedServiceId, setResolvedServiceId] = useState<string | null>(
    null
  )
  const {
    services,
    servicesLoading,
    servicesError,
    reloadServices,
    packages,
    packagesLoading,
    packagesError,
    reloadPackages,
    mutating,
    createPackage,
    updatePackage,
    togglePackage,
    deletePackage,
  } = usePackages(resolvedServiceId)

  const [filter, setFilter] = useState<PackageFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<PackageModalMode>('create')
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(
    null
  )
  const [packageToDelete, setPackageToDelete] = useState<PackageItem | null>(
    null
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === resolvedServiceId)

  useEffect(() => {
    if (servicesLoading || servicesError) return
    const valid = services.some((s) => s.id === urlServiceId)
    const next = valid ? urlServiceId : (services[0]?.id ?? null)
    setResolvedServiceId(next)
    if (next && next !== urlServiceId) {
      router.replace(`${pathname}?serviceId=${encodeURIComponent(next)}`)
    }
  }, [servicesLoading, servicesError, services, urlServiceId, pathname, router])

  useEffect(() => {
    setFilter('all')
  }, [resolvedServiceId])

  const activeCount = packages.filter((p) => p.isActive).length
  const counts: Record<PackageFilter, number> = {
    all: packages.length,
    active: activeCount,
    inactive: packages.length - activeCount,
  }
  const visiblePackages = useMemo(
    () =>
      packages.filter((p) =>
        filter === 'all' ? true : filter === 'active' ? p.isActive : !p.isActive
      ),
    [packages, filter]
  )

  const limitReached = isPackageLimitReached(packages.length)
  const listReady =
    !servicesLoading && !servicesError && !packagesLoading && !packagesError
  const canAdd = Boolean(selectedService) && listReady && !limitReached

  function handleSelectService(id: string) {
    setResolvedServiceId(id)
    router.replace(`${pathname}?serviceId=${encodeURIComponent(id)}`)
  }

  function openCreate() {
    setSelectedPackage(null)
    setModalMode('create')
    setModalOpen(true)
  }

  function openEdit(item: PackageItem) {
    setSelectedPackage(item)
    setModalMode('edit')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelectedPackage(null)
  }

  async function handleSubmit(input: PackageFormInput) {
    const result =
      modalMode === 'edit' && selectedPackage
        ? await updatePackage(selectedPackage.id, input)
        : await createPackage(input)

    if (result.ok) {
      toast.success(result.message)
    } else if (result.errors.general) {
      toast.error(result.errors.general)
    }
    return result
  }

  async function handleToggle(item: PackageItem) {
    const result = await togglePackage(item)
    if (result.ok) toast.success(result.message)
    else toast.error(result.message)
  }

  async function handleConfirmDelete(item: PackageItem) {
    const result = await deletePackage(item)
    if (result.ok) {
      setDeleteError(null)
      setPackageToDelete(null)
      toast.success(result.message)
    } else {
      setDeleteError(result.message)
      toast.error(result.message)
    }
  }

  function renderBody() {
    const resolving = !servicesError && services.length > 0 && !resolvedServiceId
    if (servicesLoading || resolving || (packagesLoading && !servicesError)) {
      return <PackageSkeleton />
    }

    if (servicesError) {
      return (
        <StatePanel
          tone="error"
          icon={<XCircleIcon size={22} />}
          badge="Gagal memuat"
          title="Gagal memuat daftar jasa."
          text="Periksa koneksi lalu coba lagi. Tidak ada data contoh yang ditampilkan."
          action={
            <button type="button" className="pkg-btn pkg-btn--primary" onClick={reloadServices}>
              <RefreshIcon size={16} />
              <span>Coba Lagi</span>
            </button>
          }
        />
      )
    }

    if (services.length === 0) {
      return (
        <StatePanel
          icon={<BriefcaseIcon size={22} />}
          badge="Belum punya jasa"
          title="Kamu belum punya jasa."
          text="Buat jasa dulu sebelum menambah paket. Paket selalu menempel ke salah satu jasa kamu."
          action={
            <Link href="/provider/dashboard/services" className="pkg-btn pkg-btn--primary">
              <PlusIcon size={16} />
              <span>Buat Jasa</span>
            </Link>
          }
        />
      )
    }

    if (packagesError) {
      return (
        <StatePanel
          tone="error"
          icon={<XCircleIcon size={22} />}
          badge="Gagal memuat"
          title="Gagal memuat daftar paket."
          text="Periksa koneksi lalu coba lagi. Tidak ada data contoh yang ditampilkan."
          action={
            <button type="button" className="pkg-btn pkg-btn--primary" onClick={reloadPackages}>
              <RefreshIcon size={16} />
              <span>Coba Lagi</span>
            </button>
          }
        />
      )
    }

    if (packages.length === 0) {
      return (
        <>
          {selectedService && !selectedService.isActive && <InactiveServiceBanner />}
          <StatePanel
            icon={<PackageIcon size={22} />}
            badge="Belum ada paket"
            title="Belum ada paket untuk jasa ini."
            text='Tambahkan paket pertama, misalnya "Dasar" atau "Lengkap", supaya pelanggan tahu pilihan dan harganya.'
            action={
              <button type="button" className="pkg-btn pkg-btn--primary" onClick={openCreate}>
                <PlusIcon size={16} />
                <span>Tambah Paket</span>
              </button>
            }
          />
        </>
      )
    }

    return (
      <>
        {selectedService && !selectedService.isActive && <InactiveServiceBanner />}
        {limitReached && (
          <div className="pkg-notice" role="status">
            <AlertIcon size={16} />
            <span>
              Maksimal {MAX_PACKAGES_PER_SERVICE} paket per jasa. Hapus paket
              lama untuk menambah yang baru.
            </span>
          </div>
        )}

        {visiblePackages.length === 0 ? (
          <p className="pkg-filter-empty" role="status">
            Tidak ada paket berstatus {filter === 'active' ? 'Aktif' : 'Nonaktif'}.
          </p>
        ) : (
          <div className="pkg-grid">
            {visiblePackages.map((item) => (
              <PackageCard
                key={item.id}
                item={item}
                disabled={mutating}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={(target) => {
                  setDeleteError(null)
                  setPackageToDelete(target)
                }}
              />
            ))}
          </div>
        )}
      </>
    )
  }

  const showPicker = !servicesLoading && !servicesError && services.length > 0

  return (
    <DashboardShell
      eyebrow="Dashboard Penyedia Jasa"
      title="Paket & Harga Layanan"
      description="Susun pilihan paket untuk tiap jasa. Hanya paket aktif yang tampil ke pelanggan."
    >
      <div className="pkg-workspace">
        <Link href="/provider/dashboard" className="pkg-back">
          <ArrowLeftIcon size={16} />
          <span>Kembali ke Dashboard Penyedia Jasa</span>
        </Link>

        <section className="pkg-section" aria-labelledby="pkg-heading">
          <div className="pkg-head">
            <div className="pkg-head__copy">
              <h2 id="pkg-heading">Daftar Paket &amp; Harga</h2>
              <p>
                Hanya paket berstatus Aktif yang tampil ke pelanggan, diurutkan
                dari harga termurah.
              </p>
            </div>
            <button
              type="button"
              className="pkg-btn pkg-btn--primary"
              onClick={openCreate}
              disabled={!canAdd}
            >
              <PlusIcon size={18} />
              <span>Tambah Paket</span>
            </button>
          </div>

          {showPicker && (
            <div className="pkg-picker">
              <div className="pkg-picker__service">
                <label htmlFor="pkg-service-select">
                  Pilih jasa <span className="pkg-required">*</span>
                </label>
                <select
                  id="pkg-service-select"
                  className="pkg-input"
                  value={resolvedServiceId ?? ''}
                  onChange={(event) => handleSelectService(event.target.value)}
                  disabled={mutating}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {listReady && (
                <div className="pkg-picker__side">
                  <span className="pkg-slots">
                    {Math.max(MAX_PACKAGES_PER_SERVICE - packages.length, 0)} slot
                    paket tersisa
                  </span>
                  <div className="pkg-filters" role="group" aria-label="Filter status paket">
                    {FILTERS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`pkg-chip${filter === item.value ? ' pkg-chip--on' : ''}`}
                        aria-pressed={filter === item.value}
                        onClick={() => setFilter(item.value)}
                      >
                        <span>{item.label}</span>
                        <span className="pkg-chip__count">{counts[item.value]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {renderBody()}
        </section>

        <PackageFormModal
          open={modalOpen}
          mode={modalMode}
          serviceName={selectedService?.name ?? ''}
          initialPackage={selectedPackage}
          submitting={mutating}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />

        <DeletePackageDialog
          open={Boolean(packageToDelete)}
          item={packageToDelete}
          serviceName={selectedService?.name ?? ''}
          submitting={mutating}
          errorMessage={deleteError}
          onCancel={() => {
            setDeleteError(null)
            setPackageToDelete(null)
          }}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  )
}

function InactiveServiceBanner() {
  return (
    <div className="pkg-notice pkg-notice--warning" role="status">
      <AlertIcon size={16} />
      <span>Jasa ini nonaktif, paket tidak tampil ke pelanggan.</span>
    </div>
  )
}

interface StatePanelProps {
  icon: React.ReactNode
  badge: string
  title: string
  text: string
  action: React.ReactNode
  tone?: 'default' | 'error'
}

function StatePanel({ icon, badge, title, text, action, tone = 'default' }: StatePanelProps) {
  return (
    <div className="pkg-state" role={tone === 'error' ? 'alert' : 'status'}>
      <span className="pkg-state__badge">{badge}</span>
      <span className={`pkg-state__icon${tone === 'error' ? ' pkg-state__icon--error' : ''}`}>
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function PackageSkeleton() {
  return (
    <div className="pkg-grid" aria-busy="true" aria-label="Memuat daftar paket">
      {[0, 1, 2].map((key) => (
        <div key={key} className="pkg-card pkg-skeleton">
          <span className="pkg-skeleton__bar pkg-skeleton__bar--title" />
          <span className="pkg-skeleton__bar" />
          <span className="pkg-skeleton__bar pkg-skeleton__bar--price" />
          <span className="pkg-skeleton__bar pkg-skeleton__bar--actions" />
        </div>
      ))}
    </div>
  )
}
