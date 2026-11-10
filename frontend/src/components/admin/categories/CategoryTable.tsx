'use client'

import type { Category } from '@/types/category'
import { AlertIcon } from '@/components/ui/AuthIcons'
import {
  CategoryTagIcon,
  EditIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from './CategoryIcons'

interface CategoryTableProps {
  categories: Category[]
  loading: boolean
  error: string | null
  onAddClick: () => void
  onEditClick: (category: Category) => void
  onDeleteClick: (category: Category) => void
  onRetry: () => void
}

export function CategoryTable({
  categories,
  loading,
  error,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onRetry,
}: CategoryTableProps) {
  if (loading) {
    return (
      <div
        className="cat-state-panel"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="cat-skeleton-head">
          <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
          <div>
            <h3>Memuat daftar kategori jasa...</h3>
            <p>Mohon tunggu sebentar sementara data kategori disiapkan.</p>
          </div>
        </div>

        <div className="cat-skeleton-rows" aria-hidden="true">
          {[1, 2, 3, 4].map((row) => (
            <div className="cat-skeleton-row" key={row}>
              <span className="cat-skeleton-bar cat-skeleton-bar--no" />
              <span className="cat-skeleton-bar cat-skeleton-bar--name" />
              <span className="cat-skeleton-bar cat-skeleton-bar--desc" />
              <span className="cat-skeleton-bar cat-skeleton-bar--actions" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cat-state-panel cat-state-panel--error" role="alert">
        <span className="cat-state-icon cat-state-icon--error" aria-hidden="true">
          <AlertIcon size={24} />
        </span>
        <h3>Gagal memuat daftar kategori</h3>
        <p>{error}</p>
        <button
          type="button"
          className="cat-btn cat-btn--secondary"
          onClick={onRetry}
        >
          <RefreshIcon size={16} />
          <span>Coba Lagi</span>
        </button>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="cat-state-panel cat-state-panel--empty">
        <span className="cat-state-icon" aria-hidden="true">
          <CategoryTagIcon size={26} />
        </span>
        <h3>Belum ada kategori jasa.</h3>
        <p>
          Tambahkan kategori pertama untuk mulai mengelompokkan layanan jasa di
          LOKA.
        </p>
        <button
          type="button"
          className="cat-btn cat-btn--primary"
          onClick={onAddClick}
        >
          <PlusIcon size={17} />
          <span>Tambah Kategori</span>
        </button>
      </div>
    )
  }

  return (
    <div className="cat-table-container">
      <div className="cat-table-scroll">
        <table className="cat-table" aria-label="Daftar Kategori Jasa LOKA">
          <thead>
            <tr>
              <th scope="col" className="cat-col-no">
                No
              </th>
              <th scope="col" className="cat-col-name">
                Nama Kategori
              </th>
              <th scope="col" className="cat-col-desc">
                Deskripsi
              </th>
              <th scope="col" className="cat-col-usage">
                Relasi Jasa
              </th>
              <th scope="col" className="cat-col-actions">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => {
              const linkedCount = category.usageCount ?? 0
              const isInUse = linkedCount > 0

              return (
                <tr key={category.id} className="cat-table__row">
                  <td className="cat-cell-no" data-label="No">
                    <span className="cat-row-number">{index + 1}</span>
                  </td>
                  <td className="cat-cell-name" data-label="Nama Kategori">
                    <div className="cat-name-wrap">
                      <strong className="cat-name-text">{category.name}</strong>
                    </div>
                  </td>
                  <td className="cat-cell-desc" data-label="Deskripsi">
                    {category.description?.trim() ? (
                      <p className="cat-desc-text">{category.description}</p>
                    ) : (
                      <span className="cat-desc-empty">
                        Belum ada deskripsi kategori
                      </span>
                    )}
                  </td>
                  <td className="cat-cell-usage" data-label="Relasi Jasa">
                    <span
                      className={`cat-usage-pill ${
                        isInUse
                          ? 'cat-usage-pill--linked'
                          : 'cat-usage-pill--unused'
                      }`}
                    >
                      {isInUse
                        ? `${linkedCount} layanan terhubung`
                        : 'Belum digunakan'}
                    </span>
                  </td>
                  <td className="cat-cell-actions" data-label="Aksi">
                    <div className="cat-row-actions">
                      <button
                        type="button"
                        className="cat-action-btn cat-action-btn--edit"
                        onClick={() => onEditClick(category)}
                        aria-label={`Edit kategori ${category.name}`}
                      >
                        <EditIcon size={15} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="cat-action-btn cat-action-btn--delete"
                        onClick={() => onDeleteClick(category)}
                        aria-label={`Hapus kategori ${category.name}`}
                      >
                        <TrashIcon size={15} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
