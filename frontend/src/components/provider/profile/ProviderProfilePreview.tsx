'use client'

import { ClockIcon } from '@/components/ui/AuthIcons'
import { formatOperatingHours } from '@/lib/operating-hours'
import { buildWhatsAppUrl, formatWhatsAppDisplay } from '@/lib/whatsapp'
import type { OperatingHours } from '@/types/provider'
import { MapPinIcon, StoreIcon, WhatsAppIcon } from './ProfileIcons'

interface ProviderProfilePreviewProps {
  businessName: string
  bio: string
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  categoryName: string
  isPublic: boolean
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function ProviderProfilePreview({
  businessName,
  bio,
  whatsappNumber,
  address,
  serviceArea,
  operatingHours,
  categoryName,
  isPublic,
}: ProviderProfilePreviewProps) {
  const displayName = businessName.trim() || 'Nama Usaha Kamu'
  const hours = formatOperatingHours(operatingHours)

  return (
    <aside className="prf-preview" aria-label="Pratinjau profil penyedia">
      <div className="prf-preview__header">
        <span className="prf-preview__avatar" aria-hidden="true">
          {initials(displayName) || 'LK'}
        </span>
        <div>
          <span className="prf-preview__eyebrow">Pratinjau Profil Publik</span>
          <h3>{displayName}</h3>
          <span
            className={`prf-preview__status ${
              isPublic
                ? 'prf-preview__status--public'
                : 'prf-preview__status--hidden'
            }`}
          >
            {isPublic ? 'Tampil di publik' : 'Belum dipublikasikan'}
          </span>
        </div>
      </div>

      {categoryName && (
        <p className="prf-preview__category">
          <StoreIcon size={15} />
          <span>{categoryName}</span>
        </p>
      )}

      {bio.trim() && <p className="prf-preview__bio">{bio.trim()}</p>}

      <dl className="prf-preview__details">
        {serviceArea.trim() && (
          <div>
            <dt>
              <MapPinIcon size={15} />
              Area layanan
            </dt>
            <dd>{serviceArea.trim()}</dd>
          </div>
        )}

        {address.trim() && (
          <div>
            <dt>
              <MapPinIcon size={15} />
              Alamat
            </dt>
            <dd>{address.trim()}</dd>
          </div>
        )}

        <div>
          <dt>
            <ClockIcon size={15} />
            Jam operasional
          </dt>
          <dd>
            <ul className="prf-preview__hours">
              {hours.map((item) => (
                <li key={item.day}>
                  <span>{item.label}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {whatsappNumber.trim() && (
        <a
          className="prf-preview__whatsapp"
          href={buildWhatsAppUrl(
            whatsappNumber,
            `Halo ${displayName}, saya melihat profil usaha Anda di LOKA.`
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon size={18} />
          <span>{formatWhatsAppDisplay(whatsappNumber)}</span>
        </a>
      )}
    </aside>
  )
}
