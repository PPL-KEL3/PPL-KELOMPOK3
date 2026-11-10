'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { authApi, ApiError } from '@/lib/api'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  LockIcon,
  XCircleIcon,
} from '@/components/ui/AuthIcons'

interface ResetCredentials {
  tokenHash?: string
  accessToken?: string
  refreshToken?: string
  code?: string
}

type PageState = 'checking' | 'ready' | 'invalid' | 'success'

interface FieldErrors {
  password?: string
  confirmPassword?: string
}

export default function ResetPasswordClient() {
  const parsed = useRef(false)

  const [state, setState] = useState<PageState>('checking')
  const [credentials, setCredentials] = useState<ResetCredentials>({})
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (parsed.current) return
    parsed.current = true

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const errorCode =
      query.get('error_code') ??
      query.get('error') ??
      hash.get('error_code') ??
      hash.get('error')

    if (errorCode) {
      setState('invalid')
      return
    }

    const tokenHash = query.get('token_hash') ?? hash.get('token_hash') ?? undefined
    const accessToken =
      hash.get('access_token') ?? query.get('access_token') ?? undefined
    const refreshToken =
      hash.get('refresh_token') ?? query.get('refresh_token') ?? undefined
    const code = query.get('code') ?? hash.get('code') ?? undefined

    if (tokenHash || (accessToken && refreshToken) || code) {
      setCredentials({ tokenHash, accessToken, refreshToken, code })
      setState('ready')
    } else {
      setState('invalid')
    }

    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`
      )
    }
  }, [])

  function validate(): FieldErrors {
    const errors: FieldErrors = {}

    if (!password) {
      errors.password = 'Password wajib diisi.'
    } else if (password.length < 8) {
      errors.password = 'Password minimal 8 karakter.'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Konfirmasi password wajib diisi.'
    } else if (password && confirmPassword !== password) {
      errors.confirmPassword = 'Konfirmasi password tidak sama.'
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
      await authApi.resetPassword({
        password,
        tokenHash: credentials.tokenHash,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        code: credentials.code,
      })
      setState('success')
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.fields) {
          setFieldErrors({
            password: error.fields.password,
            confirmPassword: error.fields.confirmPassword,
          })
        } else if (error.code === 'INVALID_RESET_LINK') {
          setState('invalid')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Tidak dapat mengubah password. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'checking') {
    return <AuthLoadingScreen message="Memeriksa link reset password…" />
  }

  if (state === 'invalid') {
    return (
      <AuthLayout>
        <div className="auth-success auth-success--error">
          <span className="auth-success__icon">
            <XCircleIcon size={30} />
          </span>
          <h1>Link Tidak Valid</h1>
          <p>Link reset password tidak valid atau sudah kedaluwarsa.</p>
          <p className="auth-success__note">
            Link reset password hanya dapat digunakan satu kali. Minta link baru untuk
            melanjutkan.
          </p>
          <Link href="/forgot-password" className="auth-submit auth-submit--link">
            Minta Link Baru
          </Link>
          <Link href="/login" className="auth-back-link auth-back-link--center">
            <ArrowLeftIcon size={17} />
            Kembali ke Login
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (state === 'success') {
    return (
      <AuthLayout>
        <div className="auth-success">
          <span className="auth-success__icon">
            <CheckCircleIcon size={30} />
          </span>
          <h1>Password Berhasil Diubah</h1>
          <p>Password akun LOKA kamu sudah diperbarui.</p>
          <p className="auth-success__note">
            Semua sesi sebelumnya telah diakhiri. Silakan masuk kembali menggunakan
            password baru kamu.
          </p>
          <Link href="/login" className="auth-submit auth-submit--link">
            Masuk ke LOKA
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Pemulihan akun</p>
        <h1>Atur Password Baru</h1>
        <p className="auth-card__subtitle">
          Buat password baru yang kuat untuk mengamankan akun LOKA kamu.
        </p>
      </header>

      {formError && <AuthAlert tone="error">{formError}</AuthAlert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="reset-password"
          label="Password Baru"
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

        <AuthInput
          id="reset-confirm-password"
          label="Konfirmasi Password Baru"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value)
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
          }}
          placeholder="Ulangi password baru kamu"
          icon={<LockIcon size={19} />}
          error={fieldErrors.confirmPassword}
          isPassword
          disabled={submitting}
        />

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="auth-spinner" aria-hidden="true" />}
          <span>{submitting ? 'Menyimpan password…' : 'Simpan Password Baru'}</span>
        </button>
      </form>

      <Link href="/login" className="auth-back-link">
        <ArrowLeftIcon size={17} />
        Kembali ke Login
      </Link>
    </AuthLayout>
  )
}
