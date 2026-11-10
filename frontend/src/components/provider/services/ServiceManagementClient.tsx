'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ArrowLeftIcon, InfoIcon } from '@/components/ui/AuthIcons'
import { useToast } from '@/components/ui/ToastProvider'
import { DEFAULT_DEMO_PROVIDER_ID } from '@/data/mock-services'
import { useServices } from '@/hooks/useServices'
import type { ServiceFormInput, ServiceItem } from '@/types/service'
import { DeleteServiceDialog } from './DeleteServiceDialog'
import {
  ServiceFormModal,
  type ServiceModalMode,
} from './ServiceFormModal'
import { PlusIcon, RefreshIcon } from './ServiceIcons'
import { ServiceTable } from './ServiceTable'

export function ServiceManagementClient() {
  const { user } = useAuth()
  const toast = useToast()
  const providerId = user?.id ?? DEFAULT_DEMO_PROVIDER_ID

  const {
    services,
    categories,
    dataSource,
    loading,
    mutating,
    error,
    hasLocalChanges,
    lastActionNotice,
    createService,
    updateService,
    toggleServiceStatus,
    deleteService,
    reloadServices,
    resetMockServices,
  } = useServices(providerId)

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formModalMode, setFormModalMode] = useState<ServiceModalMode>('create')
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(
    null
  )
  const [serviceToDelete, setServiceToDelete] = useState<ServiceItem | null>(
    null
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const activeCount = services.filter((item) => item.isActive).length
  const inactiveCount = services.length - activeCount

  function handleOpenCreateModal() {
    setSelectedService(null)
    setFormModalMode('create')
    setFormModalOpen(true)
  }

  function handleOpenEditModal(service: ServiceItem) {
    setSelectedService(service)
    setFormModalMode('edit')
    setFormModalOpen(true)
  }

  function handleCloseFormModal() {
    setFormModalOpen(false)
    setSelectedService(null)
  }

  async function handleFormSubmit(input: ServiceFormInput) {
    if (formModalMode === 'edit' && selectedService) {
      const result = await updateService(selectedService.id, input)
      if (result.ok) {
        toast.success(result.message)
      }
      return result
    }

    const result = await createService(input)
    if (result.ok) {
      toast.success(result.message)
    }
    return result
  }

  async function handleToggleStatus(service: ServiceItem) {
    const result = await toggleServiceStatus(service.id)
    if (result.ok) {
      toast.info(result.message)
    } else {
      toast.error(result.message)
    }
  }

  function handleOpenDeleteDialog(service: ServiceItem) {
    setDeleteError(null)
    setServiceToDelete(service)
  }

  function handleCancelDelete() {
    setDeleteError(null)
    setServiceToDelete(null)
  }

  async function handleConfirmDelete(service: ServiceItem) {
    const result = await deleteService(service.id)

    if (result.ok) {
      setDeleteError(null)
      setServiceToDelete(null)
      toast.success(result.message)
    } else {
      setDeleteError(result.message)
      toast.error(result.message)
    }
  }

  function handleResetDemo() {
    resetMockServices()
    toast.info('Daftar layanan dikembalikan ke data awal.')
  }

  return (
    <DashboardShell
      eyebrow="Dashboard Penyedia Jasa"
      title="Manajemen Daftar Layanan Jasa"
      description="Tambah, perbarui, nonaktifkan, atau hapus layanan jasa yang kamu tawarkan kepada pelanggan di LOKA."
    >
      <div className="svc-workspace">
        <div className="svc-topbar">
          <Link href="/provider/dashboard" className="svc-back-link">
            <ArrowLeftIcon size={16} />
            <span>Kembali ke Dashboard Penyedia Jasa</span>
          </Link>

          {dataSource === 'local' ? (
            <div className="svc-demo-pill" role="status">
              <InfoIcon size={15} />
              <span>
                Mode cadangan lokal aktif (menunggu koneksi tabel layanan).
              </span>
            </div>
          ) : (
            <div className="svc-api-pill" role="status">
              <span>Terhubung ke API Layanan LOKA</span>
            </div>
          )}
        </div>

        {dataSource === 'local' && hasLocalChanges && lastActionNotice && (
          <div className="svc-local-feedback" role="status" aria-live="polite">
            <div className="svc-local-feedback__copy">
              <InfoIcon size={17} />
              <span>{lastActionNotice}</span>
            </div>
            <button
              type="button"
              className="svc-reset-btn"
              onClick={handleResetDemo}
            >
              <RefreshIcon size={14} />
              <span>Reset Data Awal</span>
            </button>
          </div>
        )}

        <section
          className="dash-card svc-section-card"
          aria-labelledby="svc-page-heading"
        >
          <div className="svc-page-header">
            <div className="svc-page-header__copy">
              <div className="svc-page-header__eyebrow-row">
                <span className="dash-card__eyebrow">Katalog Jasa Kamu</span>
                <span className="svc-count-badge">
                  {services.length} Total Layanan
                </span>
                <span className="svc-count-badge svc-count-badge--active">
                  {activeCount} Dipublikasikan
                </span>
                {inactiveCount > 0 && (
                  <span className="svc-count-badge svc-count-badge--muted">
                    {inactiveCount} Nonaktif
                  </span>
                )}
              </div>
              <h2 id="svc-page-heading">Daftar Layanan Jasa</h2>
              <p>
                Hanya layanan berstatus <strong>Dipublikasikan</strong> yang akan
                ditampilkan pada katalog pencarian pelanggan.
              </p>
            </div>

            <div className="svc-page-header__actions">
              <button
                type="button"
                className="svc-btn svc-btn--primary"
                onClick={handleOpenCreateModal}
              >
                <PlusIcon size={18} />
                <span>Tambah Layanan</span>
              </button>
            </div>
          </div>

          <ServiceTable
            services={services}
            loading={loading}
            mutating={mutating}
            error={error}
            onAddClick={handleOpenCreateModal}
            onEditClick={handleOpenEditModal}
            onToggleStatusClick={handleToggleStatus}
            onDeleteClick={handleOpenDeleteDialog}
            onRetry={reloadServices}
          />
        </section>

        <ServiceFormModal
          open={formModalOpen}
          mode={formModalMode}
          categories={categories}
          submitting={mutating}
          initialService={selectedService}
          onClose={handleCloseFormModal}
          onSubmit={handleFormSubmit}
        />

        <DeleteServiceDialog
          open={Boolean(serviceToDelete)}
          service={serviceToDelete}
          submitting={mutating}
          errorMessage={deleteError}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  )
}

