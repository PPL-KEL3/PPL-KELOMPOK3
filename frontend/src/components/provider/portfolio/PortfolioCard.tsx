import { EditIcon, TrashIcon } from '@/components/provider/services/ServiceIcons'
import type { PortfolioItem } from '@/types/portfolio'

interface PortfolioCardProps {
  item: PortfolioItem
  disabled?: boolean
  onEdit: (item: PortfolioItem) => void
  onDelete: (item: PortfolioItem) => void
}

export function PortfolioCard({ item, disabled = false, onEdit, onDelete }: PortfolioCardProps) {
  return (
    <article className="pf-card" data-testid="pf-card">
      <img className="pf-card__photo" src={item.imageUrl} alt={item.title} loading="lazy" />
      <div className="pf-card__body">
        <h3 className="pf-card__title" data-testid="pf-card-title">{item.title}</h3>
        {item.description && <p className="pf-card__desc" data-testid="pf-card-desc">{item.description}</p>}
        <div className="pf-card__actions">
          <button
            type="button"
            className="pkg-action pkg-action--edit"
            data-testid="pf-card-edit"
            onClick={() => onEdit(item)}
            disabled={disabled}
            aria-label={`Edit portofolio ${item.title}`}
          >
            <EditIcon size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="pkg-action pkg-action--delete"
            data-testid="pf-card-delete"
            onClick={() => onDelete(item)}
            disabled={disabled}
            aria-label={`Hapus portofolio ${item.title}`}
          >
            <TrashIcon size={14} />
            <span>Hapus</span>
          </button>
        </div>
      </div>
    </article>
  )
}
