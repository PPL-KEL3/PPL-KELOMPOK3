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
      className={`pkg-card${item.isActive ? '' : ' pkg-card--inactive'}`}
    >
      <div className="pkg-card__top">
        <h3>{item.name}</h3>
        <span
          className={`pkg-status ${item.isActive ? 'pkg-status--active' : 'pkg-status--inactive'}`}
        >
          {item.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>

      {item.description && (
        <p className="pkg-card__desc">{item.description}</p>
      )}

      <p className="pkg-card__price">{formatRupiah(item.price)}</p>

      <div className="pkg-card__actions">
        <button
          type="button"
          className="pkg-action pkg-action--toggle"
          onClick={() => onToggle(item)}
          disabled={disabled}
        >
          <PowerIcon size={14} />
          <span>{item.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
        </button>
        <button
          type="button"
          className="pkg-action pkg-action--edit"
          onClick={() => onEdit(item)}
          disabled={disabled}
        >
          <EditIcon size={14} />
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="pkg-action pkg-action--delete"
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
