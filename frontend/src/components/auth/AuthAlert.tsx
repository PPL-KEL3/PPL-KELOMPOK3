import type { ReactNode } from 'react'
import {
  AlertIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
} from '@/components/ui/AuthIcons'

export type AuthAlertTone = 'error' | 'success' | 'info' | 'warning'

const icons: Record<AuthAlertTone, ReactNode> = {
  error: <XCircleIcon size={19} />,
  success: <CheckCircleIcon size={19} />,
  info: <InfoIcon size={19} />,
  warning: <AlertIcon size={19} />,
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: AuthAlertTone
  children: ReactNode
}) {
  return (
    <div
      className={`auth-alert auth-alert--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="auth-alert__icon" aria-hidden="true">
        {icons[tone]}
      </span>
      <div>{children}</div>
    </div>
  )
}
