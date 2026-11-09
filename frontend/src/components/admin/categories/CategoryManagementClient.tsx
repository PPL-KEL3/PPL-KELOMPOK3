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
    loading,
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

  function handleFormSubmit(input: CategoryFormInput) {
    if (formModalMode === 'edit' && selectedCategory) {
      const result = updateCategory(selectedCategory.id, input)
      if (result.ok) {
        toast.info(
          `Kategori "${result.category.name}" diperbarui sementara pada state lokal (belum tersimpan ke database).`
        )
      }
      return result
    }

    const result = createCategory(input)
    if (result.ok) {
      toast.info(
        `Kategori "${result.category.name}" ditambahkan sementara pada state lokal (belum tersimpan ke database).`
      )
    }
    return result
  }

  function handleOpenDeleteDialog(category: Category) {
    setCategoryToDelete(category)
  }

  function handleCancelDelete() {
    setCategoryToDelete(null)
  }

  function handleConfirmDelete(category: Category) {
    const result = deleteCategory(category.id)
    setCategoryToDelete(null)

    if (result.ok) {
      toast.info(
        `Kategori "${result.deletedCategory.name}" dihapus sementara dari state lokal (belum mengubah database).`
      )
    } else {
      toast.error(result.message)
    }
  }

  function handleResetDemo() {
    resetMockCategories()
    toast.info('Data kategori dikembalikan ke data demonstrasi awal.')
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

          <div className="cat-demo-pill" role="status">
            <InfoIcon size={15} />
            <span>
              Mode demonstrasi — perubahan belum tersimpan ke database.
            </span>
          </div>
        </div>

        {hasLocalChanges && lastActionNotice && (
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
              <span>Reset Data Demo</span>
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
          initialCategory={selectedCategory}
          onClose={handleCloseFormModal}
          onSubmit={handleFormSubmit}
        />

        <DeleteCategoryDialog
          open={Boolean(categoryToDelete)}
          category={categoryToDelete}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  )
}

