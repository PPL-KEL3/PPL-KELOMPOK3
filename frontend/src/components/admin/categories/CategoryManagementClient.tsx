'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { useToast } from '@/components/ui/ToastProvider'
import { ArrowLeftIcon, InfoIcon } from '@/components/ui/AuthIcons'
import { useCategories } from '@/hooks/useCategories'
import type { Category, CategoryFormInput } from '@/types/category'
import { CategoryTable } from './CategoryTable'
import { CategoryFormModal, type CategoryModalMode } from './CategoryFormModal'
import { DeleteCategoryDialog } from './DeleteCategoryDialog'
import { PlusIcon, RefreshIcon } from './CategoryIcons'

export function CategoryManagementClient() {
  const toast = useToast()
  const {
    categories,
    dataSource,
    loading,
    mutating,
    error,
    hasLocalChanges,
    lastActionNotice,
    createCategory,
    updateCategory,
    deleteCategory,
    reloadCategories,
    resetMockCategories,
  } = useCategories()

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formModalMode, setFormModalMode] = useState<CategoryModalMode>('create')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleOpenCreateModal() {
    setSelectedCategory(null)
    setFormModalMode('create')
    setFormModalOpen(true)
  }

  function handleOpenEditModal(category: Category) {
    setSelectedCategory(category)
    setFormModalMode('edit')
    setFormModalOpen(true)
  }

  function handleCloseFormModal() {
    setFormModalOpen(false)
    setSelectedCategory(null)
  }

  async function handleFormSubmit(input: CategoryFormInput) {
    if (formModalMode === 'edit' && selectedCategory) {
      const result = await updateCategory(selectedCategory.id, input)
      if (result.ok) {
        toast.success(result.message)
      }
      return result
    }

    const result = await createCategory(input)
    if (result.ok) {
      toast.success(result.message)
    }
    return result
  }

  function handleOpenDeleteDialog(category: Category) {
    setDeleteError(null)
    setCategoryToDelete(category)
  }

  function handleCancelDelete() {
    setDeleteError(null)
    setCategoryToDelete(null)
  }

  async function handleConfirmDelete(category: Category) {
    const result = await deleteCategory(category.id)

    if (result.ok) {
      setDeleteError(null)
      setCategoryToDelete(null)
      toast.success(result.message)
    } else {
      setDeleteError(result.message)
      toast.error(result.message)
    }
  }

  function handleResetDemo() {
    resetMockCategories()
    toast.info('Daftar kategori dikembalikan ke data awal.')
  }

  return (
    <DashboardShell
      eyebrow="Dashboard Administrator"
      title="Manajemen Kategori Jasa"
      description="Kelola kategori layanan yang tersedia pada platform LOKA."
    >
      <div className="cat-workspace">
        <div className="cat-topbar">
          <Link href="/admin/dashboard" className="cat-back-link">
            <ArrowLeftIcon size={16} />
            <span>Kembali ke Dashboard Admin</span>
          </Link>

          {dataSource === 'local' ? (
            <div className="cat-demo-pill" role="status">
              <InfoIcon size={15} />
              <span>
                Mode cadangan lokal aktif (menunggu koneksi tabel database).
              </span>
            </div>
          ) : (
            <div className="cat-api-pill" role="status">
              <span>Terhubung ke API Kategori LOKA</span>
            </div>
          )}
        </div>

        {dataSource === 'local' && hasLocalChanges && lastActionNotice && (
          <div className="cat-local-feedback" role="status" aria-live="polite">
            <div className="cat-local-feedback__copy">
              <InfoIcon size={17} />
              <span>{lastActionNotice}</span>
            </div>
            <button
              type="button"
              className="cat-reset-btn"
              onClick={handleResetDemo}
            >
              <RefreshIcon size={14} />
              <span>Reset Data Awal</span>
            </button>
          </div>
        )}

        <section className="dash-card cat-section-card" aria-labelledby="cat-page-heading">
          <div className="cat-page-header">
            <div className="cat-page-header__copy">
              <div className="cat-page-header__eyebrow-row">
                <span className="dash-card__eyebrow">Direktori Layanan LOKA</span>
                <span className="cat-count-badge">
                  {categories.length} Kategori
                </span>
              </div>
              <h2 id="cat-page-heading">Manajemen Kategori Jasa</h2>
              <p>Kelola kategori layanan yang tersedia pada platform LOKA.</p>
            </div>

            <div className="cat-page-header__actions">
              <button
                type="button"
                className="cat-btn cat-btn--primary"
                onClick={handleOpenCreateModal}
              >
                <PlusIcon size={18} />
                <span>Tambah Kategori</span>
              </button>
            </div>
          </div>

          <CategoryTable
            categories={categories}
            loading={loading}
            error={error}
            onAddClick={handleOpenCreateModal}
            onEditClick={handleOpenEditModal}
            onDeleteClick={handleOpenDeleteDialog}
            onRetry={reloadCategories}
          />
        </section>

        <CategoryFormModal
          open={formModalOpen}
          mode={formModalMode}
          dataSource={dataSource}
          submitting={mutating}
          initialCategory={selectedCategory}
          onClose={handleCloseFormModal}
          onSubmit={handleFormSubmit}
        />

        <DeleteCategoryDialog
          open={Boolean(categoryToDelete)}
          category={categoryToDelete}
          submitting={mutating}
          errorMessage={deleteError}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  )
}
