import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="customer">{children}</RoleGate>
}
