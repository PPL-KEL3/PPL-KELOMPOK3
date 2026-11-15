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
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '20px',
          marginBottom: '20px',
        }}
      >
        <span className="dash-card__eyebrow">
          Koleksi Tersimpan ({allFavorites.length} Item)
        </span>
        <Link
          href="/customer/services"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 16px',
            borderRadius: '10px',
            background: 'var(--auth-primary, #245b45)',
            color: '#ffffff',
            fontSize: '12.5px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'background 150ms ease',
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
          marginBottom: '22px',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid var(--auth-border, #e2e7e1)',
            boxShadow: '0 4px 14px rgba(24, 63, 50, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--auth-muted, #78847c)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Tersimpan</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--auth-text, #25352c)', marginTop: '4px' }}>
            {allFavorites.length}
          </div>
        </div>

        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--auth-success-soft, #eaf3ec)',
            borderRadius: '14px',
            border: '1px solid #cfdbd1',
            boxShadow: '0 4px 14px rgba(24, 63, 50, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--auth-primary, #245b45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layanan Jasa</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--auth-primary, #245b45)', marginTop: '4px' }}>
            {serviceCount}
          </div>
        </div>

        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid var(--auth-border, #e2e7e1)',
            boxShadow: '0 4px 14px rgba(24, 63, 50, 0.04)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--auth-dark, #183f32)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Penyedia Jasa</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--auth-dark, #183f32)', marginTop: '4px' }}>
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
          borderRadius: '14px',
          border: '1px solid var(--auth-border, #e2e7e1)',
          boxShadow: '0 4px 14px rgba(24, 63, 50, 0.04)',
          marginBottom: '20px',
        }}
      >
        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              border: filterType === 'all' ? '1px solid var(--auth-primary, #245b45)' : '1px solid #cfdbd1',
              backgroundColor: filterType === 'all' ? 'var(--auth-primary, #245b45)' : '#ffffff',
              color: filterType === 'all' ? '#ffffff' : 'var(--auth-text, #25352c)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Semua ({allFavorites.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('service')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              border: filterType === 'service' ? '1px solid var(--auth-primary, #245b45)' : '1px solid #cfdbd1',
              backgroundColor: filterType === 'service' ? 'var(--auth-primary, #245b45)' : '#ffffff',
              color: filterType === 'service' ? '#ffffff' : 'var(--auth-text, #25352c)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Jasa ({serviceCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('provider')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              border: filterType === 'provider' ? '1px solid var(--auth-primary, #245b45)' : '1px solid #cfdbd1',
              backgroundColor: filterType === 'provider' ? 'var(--auth-primary, #245b45)' : '#ffffff',
              color: filterType === 'provider' ? '#ffffff' : 'var(--auth-text, #25352c)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease',
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
              padding: '9px 14px',
              borderRadius: '9px',
              border: '1px solid #cfdbd1',
              fontSize: '13px',
              color: 'var(--auth-text, #25352c)',
              outline: 'none',
              backgroundColor: '#ffffff',
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '42px',
              padding: '0 24px',
              backgroundColor: 'var(--auth-primary, #245b45)',
              color: '#ffffff',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'background 150ms ease',
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
