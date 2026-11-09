'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { authApi, ApiError } from '@/lib/api'
import { ArrowLeftIcon, CheckCircleIcon, MailIcon } from '@/components/ui/AuthIcons'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    setFormError(null)

    if (!trimmedEmail) {
      setFieldError('Email wajib diisi.')
      return
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFieldError('Masukkan alamat email yang valid.')
      return
    }

    setFieldError(undefined)
    setSubmitting(true)

    try {
      const result = await authApi.forgotPassword(trimmedEmail)
      setMessage(result.message)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.fields?.email) {
          setFieldError(error.fields.email)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Tidak dapat memproses permintaan. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (message) {
    return (
      <AuthLayout>
        <div className="auth-success">
          <span className="auth-success__icon">
            <CheckCircleIcon size={30} />
          </span>
          <h1>Periksa Email Kamu</h1>
          <p>{message}</p>
          <p className="auth-success__note">
            Link reset password hanya dapat digunakan satu kali dan akan kedaluwarsa
            setelah beberapa waktu.
          </p>
          <Link href="/login" className="auth-submit auth-submit--link">
            Kembali ke Login
          </Link>
          <button
            type="button"
            className="auth-text-button"
            onClick={() => {
              setMessage(null)
              setEmail('')
            }}
          >
            Gunakan alamat email lain
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header className="auth-card__header">
        <p className="auth-card__eyebrow">Pemulihan akun</p>
        <h1>Lupa Password?</h1>
        <p className="auth-card__subtitle">
          Masukkan email yang terdaftar. Kami akan mengirim link untuk mengatur ulang
          password akun LOKA kamu.
        </p>
      </header>

      {formError && <AuthAlert tone="error">{formError}</AuthAlert>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(value) => {
            setEmail(value)
            setFieldError(undefined)
          }}
          placeholder="Masukkan alamat email kamu"
          icon={<MailIcon size={19} />}
          error={fieldError}
          disabled={submitting}
        />

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="auth-spinner" aria-hidden="true" />}
          <span>{submitting ? 'Mengirim link…' : 'Kirim Link Reset Password'}</span>
        </button>
      </form>

      <Link href="/login" className="auth-back-link">
        <ArrowLeftIcon size={17} />
        Kembali ke Login
      </Link>

      <p className="auth-legal">
        Demi keamanan akun, kami tidak menampilkan apakah suatu alamat email terdaftar
        atau tidak.
      </p>
    </AuthLayout>
  )
}
