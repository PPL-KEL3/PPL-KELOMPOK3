'use client'

import { createContext, useContext } from 'react'

const InsideProviderSidebar = createContext(false)

export const ProviderSidebarProvider = InsideProviderSidebar.Provider

export function useInsideProviderSidebar(): boolean {
  return useContext(InsideProviderSidebar)
}
