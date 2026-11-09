'use client'

import { useState, type ReactNode } from 'react'
import { AlertIcon, EyeIcon, EyeOffIcon } from '@/components/ui/AuthIcons'

interface AuthInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  error?: string
  hint?: string
  icon?: ReactNode
  isPassword?: boolean
  disabled?: boolean
}

export function AuthInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  error,
  hint,
  icon,
  isPassword = false,
  disabled = false,
}: AuthInputProps) {
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const inputType = isPassword ? (visible ? 'text' : 'password') : type

  return (
    <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        {icon && (
          <span className="auth-input__icon" aria-hidden="true">
            {icon}
          </span>
        )}

        <input
          id={id}
          name={id}
          className="auth-input"
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />

        {isPassword && (
          <button
            type="button"
            className="auth-input__toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-pressed={visible}
            disabled={disabled}
          >
            {visible ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
          </button>
        )}
      </div>

      {error ? (
        <p className="auth-field__error" id={`${id}-error`}>
          <AlertIcon size={14} />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="auth-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
