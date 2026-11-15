'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFavorites } from '@/hooks/useFavorites'
import { FavoriteCard } from './FavoriteCard'
import { EditFavoriteModal } from './EditFavoriteModal'
import { DeleteFavoriteDialog } from './DeleteFavoriteDialog'
import type { FavoriteItem } from '@/types/favorite'

export function FavoritesClient() {
  const {
    favorites,
    allFavorites,
    loading,
    error,
    filterType,
    setFilterType,
    searchQuery,
    setSearchQuery,
    updateFavorite,
    removeFavorite,
    refresh,
  } = useFavorites()

  const [editingItem, setEditingItem] = useState<FavoriteItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<FavoriteItem | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const serviceCount = allFavorites.filter((f) => f.itemType === 'service').length
  const providerCount = allFavorites.filter((f) => f.itemType === 'provider').length

  async function handleConfirmDelete(item: FavoriteItem) {
    setModalSubmitting(true)
    const ok = await removeFavorite(item.id)
    setModalSubmitting(false)
    if (ok) {
      setDeletingItem(null)
    }
  }

  return (
    <div className="favorites-container" style={{ paddingBottom: '40px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <span className="dash-card__eyebrow" style={{ color: '#0284c7', fontWeight: 600 }}>
            Daftar Favorit Pelanggan (TPR-18)
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '4px 0 8px 0', color: '#0f172a' }}>
            Layanan & Penyedia Jasa Favorit
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.925rem', margin: 0, maxWidth: '600px' }}>
            Simpan jasa langganan dan profil penyedia terbaik agar mudah ditemukan kembali saat Anda membutuhkannya.
          </p>
        </div>

        <Link
          href="/customer/services"
          className="btn btn--primary"
          style={{
            backgroundColor: '#0284c7',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          🔍 Jelajahi Jasa Lainnya
        </Link>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Total Tersimpan</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {allFavorites.length}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            borderRadius: '10px',
            border: '1px solid #bfdbfe',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 500 }}>Layanan Jasa</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
            {serviceCount}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#f0fdf4',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 500 }}>Penyedia Jasa</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
            {providerCount}
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterType === 'all' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: filterType === 'all' ? '#0284c7' : '#ffffff',
              color: filterType === 'all' ? '#ffffff' : '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Semua ({allFavorites.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('service')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterType === 'service' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: filterType === 'service' ? '#0284c7' : '#ffffff',
              color: filterType === 'service' ? '#ffffff' : '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Jasa ({serviceCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('provider')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: filterType === 'provider' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: filterType === 'provider' ? '#0284c7' : '#ffffff',
              color: filterType === 'provider' ? '#ffffff' : '#334155',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Penyedia ({providerCount})
          </button>
        </div>

        {/* Search input */}
        <div style={{ flex: '1', minWidth: '220px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="Cari favorit berdasarkan nama, kategori, label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
            }}
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '1rem', color: '#64748b' }}>Memuat daftar favorit Anda...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '10px',
            color: '#b91c1c',
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Gagal Memuat Favorit</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            style={{
              marginTop: '12px',
              padding: '6px 14px',
              backgroundColor: '#b91c1c',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⭐</div>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0 0 8px 0' }}>
            {searchQuery
              ? 'Tidak ada favorit yang cocok dengan pencarian'
              : 'Belum Ada Jasa atau Penyedia Favorit'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            {searchQuery
              ? `Coba ubah kata kunci "${searchQuery}" atau reset filter Anda.`
              : 'Tambahkan layanan jasa atau penyedia terpercaya ke favorit agar Anda dapat mengaksesnya kembali dengan cepat.'}
          </p>
          <Link
            href="/customer/services"
            className="btn btn--primary"
            style={{
              backgroundColor: '#0284c7',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Mulai Cari Layanan Jasa
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '18px',
          }}
        >
          {favorites.map((item) => (
            <FavoriteCard
              key={item.id}
              item={item}
              onEdit={(it) => setEditingItem(it)}
              onDelete={(it) => setDeletingItem(it)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <EditFavoriteModal
        open={Boolean(editingItem)}
        item={editingItem}
        submitting={modalSubmitting}
        onClose={() => setEditingItem(null)}
        onSubmit={async (id, payload) => {
          setModalSubmitting(true)
          const ok = await updateFavorite(id, payload)
          setModalSubmitting(false)
          return ok
        }}
      />

      <DeleteFavoriteDialog
        open={Boolean(deletingItem)}
        item={deletingItem}
        submitting={modalSubmitting}
        onCancel={() => setDeletingItem(null)}
        onConfirm={(item) => void handleConfirmDelete(item)}
      />
    </div>
  )
}
