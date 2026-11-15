import { EditIcon, PowerIcon, TrashIcon } from '@/components/provider/services/ServiceIcons'
import { formatRupiah } from '@/lib/package-utils'
import type { PackageItem } from '@/types/package'

interface PackageCardProps {
  item: PackageItem
  disabled?: boolean
  onToggle: (item: PackageItem) => void
  onEdit: (item: PackageItem) => void
  onDelete: (item: PackageItem) => void
}

export function PackageCard({
  item,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
}: PackageCardProps) {
  return (
    <article
      data-testid="pkg-card"
      className={`pkg-card${item.isActive ? '' : ' pkg-card--inactive'}`}
    >
      <div className="pkg-card__top">
        <h3 data-testid="pkg-card-name">{item.name}</h3>
        <span
          data-testid="pkg-card-status"
          className={`pkg-status ${item.isActive ? 'pkg-status--active' : 'pkg-status--inactive'}`}
        >
          {item.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>

      {item.description && (
        <p className="pkg-card__desc" data-testid="pkg-card-desc">{item.description}</p>
      )}

      <p className="pkg-card__price" data-testid="pkg-card-price">{formatRupiah(item.price)}</p>

      <div className="pkg-card__actions">
        <button
          type="button"
          className="pkg-action pkg-action--toggle"
          data-testid="pkg-card-toggle"
          onClick={() => onToggle(item)}
          disabled={disabled}
        >
          <PowerIcon size={14} />
          <span>{item.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
        </button>
        <button
          type="button"
          className="pkg-action pkg-action--edit"
          data-testid="pkg-card-edit"
          onClick={() => onEdit(item)}
          disabled={disabled}
        >
          <EditIcon size={14} />
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="pkg-action pkg-action--delete"
          data-testid="pkg-card-delete"
          onClick={() => onDelete(item)}
          disabled={disabled}
        >
          <TrashIcon size={14} />
          <span>Hapus</span>
        </button>
      </div>
    </article>
  )
}
