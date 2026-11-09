import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'

export default function ProviderDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="provider" requireVerifiedProvider>
      {children}
    </RoleGate>
  )
}
