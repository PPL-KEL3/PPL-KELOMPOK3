import type { ReactNode } from 'react'
import { RoleGate } from '@/components/auth/RoleGate'

export default function ProviderLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="provider">{children}</RoleGate>
}
