'use client'

import { AlertIcon } from '@/components/ui/AuthIcons'
import {
  DAY_KEYS,
  DAY_LABELS,
  type DayKey,
  type OperatingHours,
} from '@/types/provider'

interface OperatingHoursEditorProps {
  value: OperatingHours
  onChange: (value: OperatingHours) => void
  disabled?: boolean
  error?: string
}

export function OperatingHoursEditor({
  value,
  onChange,
  disabled = false,
  error,
}: OperatingHoursEditorProps) {
  function updateDay(day: DayKey, next: OperatingHours[DayKey]) {
    onChange({ ...value, [day]: next })
  }

  return (
    <div className="prf-hours" role="group" aria-label="Jam operasional per hari">
      {DAY_KEYS.map((day) => {
        const schedule = value[day]

        return (
          <div
            className={`prf-hour-row ${schedule.isOpen ? 'prf-hour-row--open' : 'prf-hour-row--closed'}`}
            key={day}
          >
            <label className="prf-hour-toggle">
              <input
                type="checkbox"
                checked={schedule.isOpen}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.checked) {
                    updateDay(day, {
                      isOpen: true,
                      open: schedule.open ?? '08:00',
                      close: schedule.close ?? '17:00',
                    })
                  } else {
                    updateDay(day, { isOpen: false })
                  }
                }}
              />
              <span className="prf-hour-day">{DAY_LABELS[day]}</span>
            </label>

            {schedule.isOpen ? (
              <div className="prf-hour-times">
                <label className="prf-hour-time">
                  <span>Buka</span>
                  <input
                    type="time"
                    value={schedule.open ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      updateDay(day, {
                        isOpen: true,
                        open: event.target.value,
                        close: schedule.close ?? '',
                      })
                    }
                    aria-label={`Jam buka hari ${DAY_LABELS[day]}`}
                  />
                </label>

                <span className="prf-hour-dash" aria-hidden="true">
                  –
                </span>

                <label className="prf-hour-time">
                  <span>Tutup</span>
                  <input
                    type="time"
                    value={schedule.close ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      updateDay(day, {
                        isOpen: true,
                        open: schedule.open ?? '',
                        close: event.target.value,
                      })
                    }
                    aria-label={`Jam tutup hari ${DAY_LABELS[day]}`}
                  />
                </label>
              </div>
            ) : (
              <span className="prf-hour-closed">Tutup</span>
            )}
          </div>
        )
      })}

      {error && (
        <p className="auth-field__error">
          <AlertIcon size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
