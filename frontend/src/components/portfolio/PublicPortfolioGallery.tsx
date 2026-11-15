'use client'

import { useCallback, useRef, useState } from 'react'
import type { PortfolioItem } from '@/types/portfolio'
import { PortfolioLightbox } from './PortfolioLightbox'
import './public-portfolio.css'

interface PublicPortfolioGalleryProps {
  items: PortfolioItem[]
  /** Judul bagian. Default mengikuti layar 7 Pencil. */
  title?: string
  headingLevel?: 'h2' | 'h3'
}

/**
 * Galeri portofolio publik (layar 7) + lightbox (layar 14).
 * Dibuat reusable untuk dipasang di profil publik `/providers/[id]` nanti (v1.1).
 * Mengembalikan `null` bila kosong, sehingga bagian ini otomatis tersembunyi.
 */
export function PublicPortfolioGallery({
  items,
  title = 'Contoh hasil pekerjaan',
  headingLevel = 'h2',
}: PublicPortfolioGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastIndexRef = useRef(0)

  const close = useCallback(() => {
    setOpenIndex(null)
    // Kembalikan fokus ke foto terakhir yang dilihat.
    window.setTimeout(() => tileRefs.current[lastIndexRef.current]?.focus(), 0)
  }, [])

  const changeIndex = useCallback((next: number) => {
    lastIndexRef.current = next
    setOpenIndex(next)
  }, [])

  if (items.length === 0) return null

  const Heading = headingLevel

  return (
    <section className="pfpub-section" aria-label="Portofolio penyedia jasa">
      <div className="pfpub-head">
        <div className="pfpub-head__copy">
          <span className="pfpub-eyebrow">Portofolio</span>
          <Heading className="pfpub-head__title">{title}</Heading>
        </div>
        <span className="pfpub-count">{items.length} foto</span>
      </div>

      <ul className="pfpub-grid">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              ref={(node) => {
                tileRefs.current[index] = node
              }}
              type="button"
              className="pfpub-tile"
              onClick={() => changeIndex(index)}
              aria-label={`Perbesar foto: ${item.title}`}
            >
              <img src={item.imageUrl} alt="" loading="lazy" />
              <span className="pfpub-tile__title">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <PortfolioLightbox
          items={items}
          index={openIndex}
          onIndexChange={changeIndex}
          onClose={close}
        />
      )}
    </section>
  )
}
