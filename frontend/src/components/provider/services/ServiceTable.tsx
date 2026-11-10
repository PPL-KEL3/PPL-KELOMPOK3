'use client'

import { formatRupiah } from '@/data/mock-services'
import type { ServiceItem } from '@/types/service'
import { AlertIcon } from '@/components/ui/AuthIcons'
import {
  BriefcaseIcon,
  EditIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  TrashIcon,
} from './ServiceIcons'

interface ServiceTableProps {
  services: ServiceItem[]
  loading: boolean
  mutating?: boolean
  error: string | null
  onAddClick: () => void
  onEditClick: (service: ServiceItem) => void
  onToggleStatusClick: (service: ServiceItem) => void
  onDeleteClick: (service: ServiceItem) => void
  onRetry: () => void
}

export function ServiceTable({
  services,
  loading,
  mutating = false,
  error,
  onAddClick,
  onEditClick,
  onToggleStatusClick,
  onDeleteClick,
  onRetry,
}: ServiceTableProps) {
  if (loading) {
    return (
      <div
        className="svc-state-panel"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="svc-skeleton-head">
          <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
          <div>
            <h3>Memuat daftar layanan jasa...</h3>
            <p>Mohon tunggu sebentar sementara katalog layanan disiapkan.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="svc-state-panel svc-state-panel--error" role="alert">
        <span className="svc-state-icon svc-state-icon--error" aria-hidden="true">
          <AlertIcon size={24} />
        </span>
        <h3>Gagal memuat daftar layanan</h3>
        <p>{error}</p>
        <button
          type="button"
          className="svc-btn svc-btn--secondary"
          onClick={onRetry}
        >
          <RefreshIcon size={16} />
          <span>Coba Lagi</span>
        </button>
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <div className="svc-state-panel svc-state-panel--empty">
        <span className="svc-state-icon" aria-hidden="true">
          <BriefcaseIcon size={26} />
        </span>
        <h3>Belum ada layanan jasa yang didaftarkan.</h3>
        <p>
          Tambahkan layanan jasa pertama agar pelanggan dapat menemukan keahlian
          dan harga layanan kamu di LOKA.
        </p>
        <button
          type="button"
          className="svc-btn svc-btn--primary"
          onClick={onAddClick}
        >
          <PlusIcon size={17} />
          <span>Tambah Layanan</span>
        </button>
      </div>
    )
  }

  return (
    <div className="svc-table-container">
      <div className="svc-table-scroll">
        <table className="svc-table" aria-label="Daftar Layanan Jasa Penyedia">
          <thead>
            <tr>
              <th scope="col" className="svc-col-no">
                No
              </th>
              <th scope="col" className="svc-col-info">
                Nama & Deskripsi Jasa
              </th>
              <th scope="col" className="svc-col-cat">
                Kategori
              </th>
              <th scope="col" className="svc-col-price">
                Harga Dasar
              </th>
              <th scope="col" className="svc-col-status">
                Status Publikasi
              </th>
              <th scope="col" className="svc-col-actions">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service, index) => (
              <tr key={service.id} className="svc-table__row">
                <td className="svc-cell-no" data-label="No">
                  <span className="svc-row-number">{index + 1}</span>
                </td>
                <td className="svc-cell-info" data-label="Layanan Jasa">
                  <div className="svc-info-wrap">
                    <strong className="svc-name-text">{service.name}</strong>
                    <p className="svc-desc-text">{service.description}</p>
                  </div>
                </td>
                <td className="svc-cell-cat" data-label="Kategori">
                  <span className="svc-category-badge">
                    {service.categoryName}
                  </span>
                </td>
                <td className="svc-cell-price" data-label="Harga Dasar">
                  <strong className="svc-price-text">
                    {formatRupiah(service.price)}
                  </strong>
                </td>
                <td className="svc-cell-status" data-label="Status Publikasi">
                  <span
                    className={`svc-status-pill ${
                      service.isActive
                        ? 'svc-status-pill--active'
                        : 'svc-status-pill--inactive'
                    }`}
                  >
                    {service.isActive ? 'Dipublikasikan' : 'Nonaktif'}
                  </span>
                </td>
                <td className="svc-cell-actions" data-label="Aksi">
                  <div className="svc-row-actions">
                    <button
                      type="button"
                      className="svc-action-btn svc-action-btn--toggle"
                      disabled={mutating}
                      onClick={() => onToggleStatusClick(service)}
                      aria-label={
                        service.isActive
                          ? `Nonaktifkan layanan ${service.name}`
                          : `Aktifkan layanan ${service.name}`
                      }
                    >
                      <PowerIcon size={14} />
                      <span>{service.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>
                    <button
                      type="button"
                      className="svc-action-btn svc-action-btn--edit"
                      disabled={mutating}
                      onClick={() => onEditClick(service)}
                      aria-label={`Edit layanan ${service.name}`}
                    >
                      <EditIcon size={15} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="svc-action-btn svc-action-btn--delete"
                      disabled={mutating}
                      onClick={() => onDeleteClick(service)}
                      aria-label={`Hapus layanan ${service.name}`}
                    >
                      <TrashIcon size={15} />
                      <span>Hapus</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

