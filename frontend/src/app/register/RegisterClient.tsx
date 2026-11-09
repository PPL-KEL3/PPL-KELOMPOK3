'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  CheckCircleIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from '@/components/ui/AuthIcons'
import { ApiError } from '@/lib/api'
import { dashboardPathFor } from '@/lib/auth-types'

type PublicRole = 'customer' | 'provider'

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  role?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterClient() {
  const router = useRouter()
  const { user, loading, register } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<PublicRole>('customer')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ email: string; message: string } | null>(
    null
  )

  useEffect(() => {
    if (!loading && user) {
      router.replace(dashboardPathFor(user))
    }
  }, [loading, user, router])

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      errors.fullName = 'Nama lengkap wajib diisi.'
    } else if (trimmedName.length < 2) {
      errors.fullName = 'Nama lengkap minimal 2 karakter.'
    }

    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.'
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = 'Masukkan alamat email yang valid.'
    }

    if (!password) {
      errors.password = 'Password wajib diisi.'
    } else if (password.length < 8) {
      errors.password = 'Password minimal 8 karakter.'
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
      const result = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      })

      if (result.requiresEmailConfirmation) {
        setConfirmation({
          email: email.trim(),
          message: result.message,
        })
        return
      }

      if (result.user) {
        router.replace(result.redirectTo || dashboardPathFor(result.user))
        router.refresh()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.fields) {
          setFieldErrors({
            fullName: error.fields.fullName,
            email: error.fields.email,
            password: error.fields.password,
            role: error.fields.role,
          })
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Tidak dapat memproses pendaftaran. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <AuthLayout>
        <div className="auth-success">
          <span className="auth-success__icon">
            <CheckCircleIcon size={30} />
          </span>
          <h1>Periksa Email Kamu</h1>
          <p>{confirmation.message}</p>
          <p className="auth-success__email">{confirmation.email}</p>
          <p className="auth-success__note">
            Setelah email terverifikasi, masuk ke akun LOKA kamu untuk melanjutkan.
          </p>
          <Link href="/login" className="auth-submit auth-submit--link">
            Buka Halaman Masuk
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Bergabung dengan LOKA</p>
        <h1>Buat Akun LOKA</h1>
        <p className="auth-card__subtitle">
          Pilih jenis akun, lalu lengkapi data dirimu untuk mulai terhubung.
        </p>
      </header>

      {formError && <AuthAlert tone="error">{formError}</AuthAlert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="auth-role-group">
          <legend>Daftar sebagai</legend>
          <div className="auth-role-grid">
            <label className={`auth-role ${role === 'customer' ? 'auth-role--active' : ''}`}>
              <input
                type="radio"
                name="role"
                value="customer"
                checked={role === 'customer'}
                onChange={() => setRole('customer')}
                disabled={submitting}
              />
              <span className="auth-role__radio" aria-hidden="true" />
              <span className="auth-role__copy">
                <strong>Customer</strong>
                <small>Cari dan booking jasa lokal</small>
              </span>
            </label>

            <label className={`auth-role ${role === 'provider' ? 'auth-role--active' : ''}`}>
              <input
                type="radio"
                name="role"
                value="provider"
                checked={role === 'provider'}
                onChange={() => setRole('provider')}
                disabled={submitting}
              />
              <span className="auth-role__radio" aria-hidden="true" />
              <span className="auth-role__copy">
                <strong>Penyedia Jasa</strong>
                <small>Tawarkan keahlian dan layananmu</small>
              </span>
            </label>
          </div>
          {fieldErrors.role && <p className="auth-field__error">{fieldErrors.role}</p>}
        </fieldset>

        <AuthInput
          id="register-name"
          label="Nama Lengkap"
          autoComplete="name"
          value={fullName}
          onChange={(value) => {
            setFullName(value)
            setFieldErrors((current) => ({ ...current, fullName: undefined }))
          }}
          placeholder="Masukkan nama lengkap kamu"
          icon={<UserIcon size={19} />}
          error={fieldErrors.fullName}
          disabled={submitting}
        />

        <AuthInput
          id="register-email"
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
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setFieldErrors((current) => ({ ...current, password: undefined }))
          }}
          placeholder="Buat password minimal 8 karakter"
          icon={<LockIcon size={19} />}
          error={fieldErrors.password}
          hint="Gunakan minimal 8 karakter agar akun kamu aman."
          isPassword
          disabled={submitting}
        />

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="auth-spinner" aria-hidden="true" />}
          <span>{submitting ? 'Membuat akun…' : 'Daftar Sekarang'}</span>
        </button>
      </form>

      <p className="auth-switch">
        Sudah punya akun? <Link href="/login">Masuk di sini</Link>
      </p>

      <p className="auth-legal">
        Dengan mendaftar, kamu menyetujui <Link href="/terms">Ketentuan Layanan</Link> dan{' '}
        <Link href="/privacy">Kebijakan Privasi</Link> LOKA.
      </p>
    </AuthLayout>
  )
}
