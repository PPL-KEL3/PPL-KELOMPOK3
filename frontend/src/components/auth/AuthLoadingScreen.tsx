import { LokaLogo } from '@/components/ui/LokaLogo'

export function AuthLoadingScreen({ message = 'Memeriksa sesi kamu…' }: { message?: string }) {
  return (
    <div className="auth-boot" role="status" aria-live="polite">
      <LokaLogo />
      <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
