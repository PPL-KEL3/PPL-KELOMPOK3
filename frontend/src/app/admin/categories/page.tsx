import type { Metadata } from 'next'
import { CategoryManagementClient } from '@/components/admin/categories/CategoryManagementClient'
import './categories.css'

export const metadata: Metadata = {
  title: 'Manajemen Kategori Jasa — Admin LOKA',
  description: 'Kelola kategori layanan yang tersedia pada platform LOKA.',
}

export default function AdminCategoriesPage() {
  return <CategoryManagementClient />
}

