'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import {
  AlertIcon,
  ArrowLeftIcon,
  CloseIcon,
  ImageIcon,
  RefreshIcon,
  XCircleIcon,
} from '@/components/ui/AuthIcons'
import { useToast } from '@/components/ui/ToastProvider'
import { PlusIcon } from '@/components/provider/services/ServiceIcons'
import { PORTFOLIO_SAVE_ERROR, usePortfolio } from '@/hooks/usePortfolio'
import { isPortfolioLimitReached } from '@/lib/portfolio-utils'
import {
  PORTFOLIO_MAX_ITEMS,
  type PortfolioFormInput,
  type PortfolioItem,
} from '@/types/portfolio'
import { DeletePortfolioDialog } from './DeletePortfolioDialog'
import { PortfolioCard } from './PortfolioCard'
import { PortfolioFormModal, type PortfolioModalMode } from './PortfolioFormModal'
import { FolderOpenIcon } from './PortfolioIcons'

export function PortfolioManagementClient() {
  const toast = useToast()
  const {
    items,
    loading,
    error,
    reload,
    mutating,
    remainingSlots,
    createItem,
    updateItem,
    deleteItem,
  } = usePortfolio()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<PortfolioModalMode>('create')
  const [selected, setSelected] = useState<PortfolioItem | null>(null)
  const [toDelete, setToDelete] = useState<PortfolioItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [leftoverNotice, setLeftoverNotice] = useState(false)

  const limitReached = isPortfolioLimitReached(items.length)
  const ready = !loading && !error
  const canAdd = ready && !limitReached && !mutating

  function openCreate() {
    setSelected(null)
    setModalMode('create')
    setModalOpen(true)
  }

  function openEdit(item: PortfolioItem) {
    setSelected(item)
    setModalMode('edit')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setSelected(null)
  }

  async function handleSubmit(
    input: PortfolioFormInput,
    file: File | null,
    onProgress: (percent: number) => void
  ) {
    const result =
      modalMode === 'edit' && selected
        ? await updateItem(selected, input, file, onProgress)
        : await createItem(input, file, onProgress)

    if (result.ok) {
      toast.success(
        modalMode === 'edit'
          ? 'Perubahan portofolio disimpan.'
          : 'Portofolio baru berhasil ditambahkan.'
      )
    } else if (result.errors.general || result.uploadFailed) {
      toast.error(PORTFOLIO_SAVE_ERROR)
    }
    return result
  }

  async function handleConfirmDelete(item: PortfolioItem) {
    const result = await deleteItem(item)
    if (!result.ok) {
      setDeleteError(result.message)
      toast.error(result.message)
      return
    }

    setDeleteError(null)
    setToDelete(null)
    if (result.fileCleanupFailed) {
      setLeftoverNotice(true)
      toast.info('Item terhapus, file masih tertinggal.')
    } else {
      toast.success('Portofolio dihapus permanen.')
    }
  }

  function renderBody() {
    if (loading) return <GallerySkeleton />

    if (error) {
      return (
        <StatePanel
          tone="error"
          icon={<XCircleIcon size={22} />}
          title="Gagal memuat galeri."
          text="Periksa koneksi lalu coba lagi. Tidak ada data contoh yang ditampilkan."
          action={
            <button type="button" className="pkg-btn pkg-btn--secondary pkg-btn--sm" onClick={reload}>
              <RefreshIcon size={14} />
              <span>Coba Lagi</span>
            </button>
          }
        />
      )
    }

    if (items.length === 0) {
      return (
        <StatePanel
          icon={<ImageIcon size={22} />}
          title="Belum ada portofolio."
          text="Tambahkan foto hasil kerja pertama kamu supaya calon pelanggan bisa menilai kualitasnya."
          action={
            <button type="button" className="pkg-btn pkg-btn--primary pkg-btn--sm" onClick={openCreate}>
              <PlusIcon size={14} />
              <span>Tambah Portofolio</span>
            </button>
          }
        />
      )
    }

    return (
      <div className="pf-grid">
        {items.map((item) => (
          <PortfolioCard
            key={item.id}
            item={item}
            disabled={mutating}
            onEdit={openEdit}
            onDelete={(target) => {
              setDeleteError(null)
              setToDelete(target)
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <DashboardShell
      eyebrow="Dashboard Penyedia Jasa"
      title="Portofolio Pekerjaan"
      description="Tampilkan contoh hasil pekerjaan kamu supaya calon pelanggan melihat kualitas dan percaya memakai jasamu."
    >
      <div className="pkg-workspace">
        <Link href="/provider/dashboard" className="pkg-back">
          <ArrowLeftIcon size={16} />
          <span>Kembali ke Dashboard Penyedia Jasa</span>
        </Link>

        <section className="pkg-section pf-section" aria-labelledby="pf-heading">
          <div className="pkg-head">
            <div className="pkg-head__copy">
              <h2 id="pf-heading">Galeri Hasil Pekerjaan</h2>
              <p>Item terbaru tampil paling atas di profil publik kamu.</p>
            </div>
            <div className="pf-head-actions">
              <button
                type="button"
                className="pkg-btn pkg-btn--primary"
                onClick={openCreate}
                disabled={!canAdd}
              >
                <PlusIcon size={18} />
                <span>Tambah Portofolio</span>
              </button>
              {ready && (
                <span className="pf-slots">
                  <FolderOpenIcon size={14} />
                  <span>{remainingSlots} slot tersisa</span>
                </span>
              )}
            </div>
          </div>

          {ready && limitReached && (
            <div className="pkg-notice pkg-notice--warning" role="status">
              <AlertIcon size={16} />
              <span>
                Maksimal {PORTFOLIO_MAX_ITEMS} item per penyedia. Hapus item lama untuk
                menambah yang baru.
              </span>
            </div>
          )}

          {leftoverNotice && (
            <div className="pkg-notice pkg-notice--warning pf-notice" role="status">
              <AlertIcon size={16} />
              <span>
                <strong>Item terhapus, file masih tertinggal.</strong> Data portofolio
                sudah dihapus, tapi file fotonya belum bisa dibersihkan dari penyimpanan.
              </span>
              <button
                type="button"
                className="pf-notice__close"
                onClick={() => setLeftoverNotice(false)}
                aria-label="Tutup pemberitahuan"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          {renderBody()}
        </section>

        <PortfolioFormModal
          open={modalOpen}
          mode={modalMode}
          item={selected}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />

        <DeletePortfolioDialog
          item={toDelete}
          submitting={mutating}
          errorMessage={deleteError}
          onCancel={() => {
            setDeleteError(null)
            setToDelete(null)
          }}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </DashboardShell>
  )
}

interface StatePanelProps {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
  tone?: 'default' | 'error'
}

function StatePanel({ icon, title, text, action, tone = 'default' }: StatePanelProps) {
  return (
    <div className="pkg-state" role={tone === 'error' ? 'alert' : 'status'}>
      <span className={`pkg-state__icon${tone === 'error' ? ' pkg-state__icon--error' : ''}`}>
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function GallerySkeleton() {
  return (
    <div className="pf-grid" aria-busy="true" aria-label="Memuat galeri">
      {[0, 1, 2].map((key) => (
        <div key={key} className="pf-card pf-skeleton">
          <span className="pf-skeleton__photo" />
          <div className="pf-card__body">
            <span className="pkg-skeleton__bar pkg-skeleton__bar--title" />
            <span className="pkg-skeleton__bar" />
          </div>
        </div>
      ))}
    </div>
  )
}
