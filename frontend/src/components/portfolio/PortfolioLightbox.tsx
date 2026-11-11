'use client'

import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from '@/components/ui/AuthIcons'
import type { PortfolioItem } from '@/types/portfolio'

interface PortfolioLightboxProps {
  items: PortfolioItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

/**
 * Foto diperbesar (layar 14). Esc atau klik di luar foto menutup, panah kiri/kanan
 * dan tombol sebelumnya/berikutnya berpindah foto. Fokus dikunci di dalam dialog.
 */
export function PortfolioLightbox({ items, index, onIndexChange, onClose }: PortfolioLightboxProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  useEffect(() => {
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowLeft' && hasPrev) {
        event.preventDefault()
        onIndexChange(index - 1)
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault()
        onIndexChange(index + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, hasPrev, hasNext, onIndexChange, onClose])

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!item) return null

  return (
    <div
      ref={dialogRef}
      className="pfpub-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={trapFocus}
      onClick={(event) => {
        // Klik di luar foto, tombol, dan keterangan menutup lightbox.
        if (event.target === event.currentTarget || (event.target as HTMLElement).dataset.backdrop) {
          onClose()
        }
      }}
    >
      <div className="pfpub-lightbox__top" data-backdrop="true">
        <span className="pfpub-lightbox__counter" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          className="pfpub-lightbox__round"
          onClick={onClose}
          aria-label="Tutup foto"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="pfpub-lightbox__stage" data-backdrop="true">
        <button
          type="button"
          className={`pfpub-lightbox__round pfpub-lightbox__nav${hasPrev ? '' : ' pfpub-lightbox__nav--hidden'}`}
          onClick={() => onIndexChange(index - 1)}
          disabled={!hasPrev}
          aria-label="Foto sebelumnya"
        >
          <ArrowLeftIcon size={22} />
        </button>

        <img key={item.id} className="pfpub-lightbox__photo" src={item.imageUrl} alt={item.title} />

        <button
          type="button"
          className={`pfpub-lightbox__round pfpub-lightbox__nav${hasNext ? '' : ' pfpub-lightbox__nav--hidden'}`}
          onClick={() => onIndexChange(index + 1)}
          disabled={!hasNext}
          aria-label="Foto berikutnya"
        >
          <ArrowRightIcon size={22} />
        </button>
      </div>

      <div className="pfpub-lightbox__caption">
        <h2 id={titleId}>{item.title}</h2>
        {item.description && <p>{item.description}</p>}
        <small>Tekan Esc atau klik di luar foto untuk menutup.</small>
      </div>
    </div>
  )
}
