import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'
import { CustomerSidebarLayout } from '@/components/customer/CustomerSidebarLayout'
import '../provider/provider-sidebar.css'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="customer">
      <CustomerSidebarLayout>{children}</CustomerSidebarLayout>
    </RoleGate>
  )
}
