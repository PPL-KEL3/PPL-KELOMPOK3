'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { useAuth } from '@/components/auth/AuthProvider'
import { MailIcon, LockIcon } from '@/components/ui/AuthIcons'
import { ApiError } from '@/lib/api'
import { dashboardPathFor } from '@/lib/auth-types'

interface FieldErrors {
  email?: string
  password?: string
}

interface LoginQuery {
  expired: boolean
  nextPath: string | null
  invalidRole: boolean
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginClient() {
  const router = useRouter()
  const { user, loading, login, sessionExpired, authError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [query, setQuery] = useState<LoginQuery>({
    expired: false,
    nextPath: null,
    invalidRole: false,
  })

  const expired = query.expired || sessionExpired
  const nextPath = query.nextPath
  const invalidRole = query.invalidRole

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setQuery({
      expired: params.get('expired') === '1',
      nextPath: params.get('next'),
      invalidRole: params.get('reason') === 'invalid-role',
    })
  }, [])

  useEffect(() => {
    if (!loading && user) {
      router.replace(dashboardPathFor(user))
    }
  }, [loading, user, router])

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.'
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = 'Masukkan alamat email yang valid.'
    }

    if (!password) {
      errors.password = 'Password wajib diisi.'
    }

    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)

    if (Object.keys(errors).length > 0) return

    setSubmitting(true)

    try {
      const result = await login({
        email: email.trim(),
        password,
        remember,
      })

      router.replace(result.redirectTo || dashboardPathFor(result.user))
      router.refresh()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.fields) {
          setFieldErrors({
            email: error.fields.email,
            password: error.fields.password,
          })
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Tidak dapat memproses login. Silakan coba lagi.')
      }

      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Masuk ke akun LOKA</p>
        <h1>Selamat Datang Kembali!</h1>
        <p className="auth-card__subtitle">
          Masuk ke akun LOKA kamu untuk melanjutkan aktivitas.
        </p>
      </header>

      {expired && (
        <AuthAlert tone="info">
          Sesi kamu telah berakhir. Silakan login kembali.
        </AuthAlert>
      )}

      {nextPath && !expired && (
        <AuthAlert tone="info">Silakan masuk untuk melanjutkan.</AuthAlert>
      )}

      {(authError || invalidRole) && (
        <AuthAlert tone="error">
          {authError ??
            'Akun ini tidak memiliki role yang valid untuk mengakses LOKA. Hubungi dukungan LOKA.'}
        </AuthAlert>
      )}

      {formError && <AuthAlert tone="error">{formError}</AuthAlert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(value) => {
            setEmail(value)
            setFieldErrors((current) => ({ ...current, email: undefined }))
          }}
          placeholder="Masukkan alamat email kamu"
          icon={<MailIcon size={19} />}
          error={fieldErrors.email}
          disabled={submitting}
        />

        <AuthInput
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setFieldErrors((current) => ({ ...current, password: undefined }))
          }}
          placeholder="Masukkan password kamu"
          icon={<LockIcon size={19} />}
          error={fieldErrors.password}
          isPassword
          disabled={submitting}
        />

        <div className="auth-options">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={submitting}
            />
            <span className="auth-checkbox__box" aria-hidden="true" />
            <span>Ingat saya</span>
          </label>

          <Link href="/forgot-password" className="auth-link">
            Lupa password?
          </Link>
        </div>

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="auth-spinner" aria-hidden="true" />}
          <span>{submitting ? 'Sedang masuk…' : 'Masuk'}</span>
        </button>
      </form>

      <p className="auth-switch">
        Belum punya akun? <Link href="/register">Daftar sekarang</Link>
      </p>

      <p className="auth-legal">
        Dengan masuk, kamu menyetujui{' '}
        <Link href="/terms">Ketentuan Layanan</Link> dan{' '}
        <Link href="/privacy">Kebijakan Privasi</Link> LOKA.
      </p>
    </AuthLayout>
  )
}
