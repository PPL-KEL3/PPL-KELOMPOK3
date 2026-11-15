import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'
import { ProviderSidebarLayout } from '@/components/provider/ProviderSidebarLayout'
import './provider-sidebar.css'

export default function ProviderLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="provider">
      <ProviderSidebarLayout>{children}</ProviderSidebarLayout>
    </RoleGate>
  )
}
