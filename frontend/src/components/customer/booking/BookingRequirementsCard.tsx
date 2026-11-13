import { ImageIcon, InfoIcon } from '@/components/ui/AuthIcons'
import type { BookingRequirementPhoto } from '@/types/booking-requirements'

interface BookingRequirementsCardProps {
  notes?: string | null
  photos?: BookingRequirementPhoto[]
}

export function BookingRequirementsCard({ notes, photos = [] }: BookingRequirementsCardProps) {
  return (
    <section className="booking-detail-card booking-requirements-detail" aria-labelledby="booking-requirements-detail-title">
      <div className="booking-card__heading"><span className="booking-icon"><InfoIcon size={19} /></span><div><span className="booking-eyebrow">Informasi pekerjaan</span><h2 id="booking-requirements-detail-title">Detail Kebutuhan Pekerjaan</h2></div></div>
      <div className="booking-requirements-detail__notes"><h3>Catatan Kebutuhan</h3>{notes ? <p>{notes}</p> : <p className="booking-helper">Belum ada catatan kebutuhan yang tersimpan.</p>}</div>
      <div><h3 className="booking-subheading"><ImageIcon size={16} /> Foto Referensi Pekerjaan</h3>{photos.length ? <div className="booking-photo-grid">{photos.map((photo) => <a className="booking-photo" href={photo.url} target="_blank" rel="noreferrer" key={photo.id ?? photo.url}><img src={photo.url} alt={photo.name} /><span className="booking-photo__caption">{photo.name}</span></a>)}</div> : <p className="booking-helper">Belum ada foto referensi yang tersimpan.</p>}</div>
    </section>
  )
}
