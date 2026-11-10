'use client'

import { useState } from 'react'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AlertIcon, RefreshIcon } from '@/components/ui/AuthIcons'
import { useToast } from '@/components/ui/ToastProvider'
import {
  EditIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/provider/services/ServiceIcons'
import { useProviderServiceAreas } from '@/hooks/useProviderServiceAreas'
import type {
  ServiceArea,
  ServiceAreaFormInput,
} from '@/types/provider'
import { DeleteServiceAreaDialog } from './DeleteServiceAreaDialog'
import { MapPinIcon } from './ProfileIcons'
import {
  ServiceAreaFormModal,
  type ServiceAreaModalMode,
} from './ServiceAreaFormModal'

export function ServiceAreasCard() {
  const toast = useToast()
  const {
    serviceAreas,
    loading,
    mutating,
    error,
    createServiceArea,
    updateServiceArea,
    deleteServiceArea,
    reload,
  } = useProviderServiceAreas()

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<ServiceAreaModalMode>('create')
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null)
  const [areaToDelete, setAreaToDelete] = useState<ServiceArea | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openCreate() {
    setSelectedArea(null)
    setFormMode('create')
    setFormOpen(true)
  }

  function openEdit(area: ServiceArea) {
    setSelectedArea(area)
    setFormMode('edit')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setSelectedArea(null)
  }

  async function handleSubmit(input: ServiceAreaFormInput) {
    const result =
      formMode === 'edit' && selectedArea
        ? await updateServiceArea(selectedArea.id, input)
        : await createServiceArea(input)

    if (result.ok) {
      toast.success(result.message)
    }

    return result
  }

  function openDelete(area: ServiceArea) {
    setDeleteError(null)
    setAreaToDelete(area)
  }

  function closeDelete() {
    setDeleteError(null)
    setAreaToDelete(null)
  }

  async function handleConfirmDelete(area: ServiceArea) {
    const result = await deleteServiceArea(area.id)

    if (result.ok) {
      closeDelete()
      toast.success(result.message)
    } else {
      const message = result.errors.general ?? 'Gagal menghapus wilayah layanan.'
      setDeleteError(message)
      toast.error(message)
    }
  }

  return (
    <section className="dash-card prf-sa-card" aria-labelledby="prf-sa-heading">
      <div className="prf-sa-header">
        <div>
          <span className="dash-card__eyebrow">Jangkauan Layanan</span>
          <h2 id="prf-sa-heading">Wilayah &amp; Radius Layanan</h2>
          <p>
            Tambahkan wilayah tempat kamu bersedia bekerja. Pelanggan akan melihat
            daftar ini pada profil publik kamu.
          </p>
        </div>

        <div className="prf-sa-header__actions">
          <span className="prf-sa-count">{serviceAreas.length} Wilayah</span>
          <button
            type="button"
            className="prf-btn prf-btn--primary"
            onClick={openCreate}
            disabled={mutating}
          >
            <PlusIcon size={17} />
            <span>Tambah Wilayah</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="prf-state-panel" role="status" aria-live="polite">
          <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
          <div>
            <h3>Memuat wilayah layanan...</h3>
            <p>Mohon tunggu sebentar.</p>
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
      ) : serviceAreas.length === 0 ? (
        <div className="prf-state-panel prf-state-panel--empty">
          <span className="prf-state-icon" aria-hidden="true">
            <MapPinIcon size={26} />
          </span>
          <h3>Belum ada wilayah layanan.</h3>
          <p>
            Tambahkan wilayah pertama agar pelanggan tahu area tempat kamu
            bersedia melayani.
          </p>
          <button
            type="button"
            className="prf-btn prf-btn--primary"
            onClick={openCreate}
          >
            <PlusIcon size={17} />
            <span>Tambah Wilayah</span>
          </button>
        </div>
      ) : (
        <div className="prf-sa-list">
          {serviceAreas.map((area) => (
            <article className="prf-sa-item" key={area.id}>
              <span className="prf-sa-item__icon" aria-hidden="true">
                <MapPinIcon size={18} />
              </span>
              <div className="prf-sa-item__copy">
                <strong>{area.areaName}</strong>
                <span>Radius {area.radiusKm} km</span>
              </div>
              <div className="prf-sa-item__actions">
                <button
                  type="button"
                  className="prf-sa-action prf-sa-action--edit"
                  onClick={() => openEdit(area)}
                  disabled={mutating}
                  aria-label={`Edit wilayah ${area.areaName}`}
                >
                  <EditIcon size={15} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="prf-sa-action prf-sa-action--delete"
                  onClick={() => openDelete(area)}
                  disabled={mutating}
                  aria-label={`Hapus wilayah ${area.areaName}`}
                >
                  <TrashIcon size={15} />
                  <span>Hapus</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="prf-sa-note">
        <AlertIcon size={15} />
        <span>
          Maksimal 10 wilayah layanan. Nama wilayah tidak boleh sama.
        </span>
      </div>

      <ServiceAreaFormModal
        open={formOpen}
        mode={formMode}
        submitting={mutating}
        initialServiceArea={selectedArea}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <DeleteServiceAreaDialog
        open={Boolean(areaToDelete)}
        serviceArea={areaToDelete}
        submitting={mutating}
        errorMessage={deleteError}
        onCancel={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}
