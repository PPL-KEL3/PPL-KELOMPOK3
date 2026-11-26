import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'
import { AdminSidebarLayout } from '@/components/admin/AdminSidebarLayout'
import '../provider/provider-sidebar.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="admin"><AdminSidebarLayout>{children}</AdminSidebarLayout></RoleGate>
}
