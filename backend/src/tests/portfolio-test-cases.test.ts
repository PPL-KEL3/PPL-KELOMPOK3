import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import {
  MAX_PORTFOLIO_FILE_SIZE,
  MAX_PORTFOLIO_ITEMS,
  PORTFOLIO_BUCKET,
} from '../services/portfolio.service'

// Spesifikasi test case TPR-6 (TPR-130). Sumber: docs/test-cases/TPR-6-provider-portfolio.md
export type PortfolioTestMethod = 'automated' | 'manual-sql' | 'manual-storage' | 'ui'

export interface PortfolioTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05' | 'AC-06' | 'AC-07'
  type: 'positive' | 'negative'
  method: PortfolioTestMethod
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

/** Kode error yang dipakai PRD TPR-6 dan backend portofolio. */
export const PORTFOLIO_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_FILE_TYPE',
  'FILE_TOO_LARGE',
  'INVALID_IMAGE_PATH',
  'UPLOAD_NOT_FOUND',
  'PORTFOLIO_LIMIT_REACHED',
  'PORTFOLIO_NOT_FOUND',
  'PROVIDER_NOT_FOUND',
  'PORTFOLIO_OWNERSHIP_FORBIDDEN',
  'INVALID_PROVIDER_ID',
  'INVALID_PORTFOLIO_ID',
  'NO_SESSION',
  'FORBIDDEN',
] as const

const UPLOAD_URL = 'POST /api/providers/me/portfolio/upload-url'
const CREATE = 'POST /api/providers/me/portfolio'
const LIST_MINE = 'GET /api/providers/me/portfolio'
const LIST_PUBLIC = 'GET /api/providers/:id/portfolio'
const UPDATE = 'PATCH /api/providers/me/portfolio/:id'
const REMOVE = 'DELETE /api/providers/me/portfolio/:id'

export const TPR_130_PORTFOLIO_TEST_CASES: readonly PortfolioTestCaseSpec[] = [
  { id: 'TC-PF-01', acceptanceCriteria: 'AC-01', type: 'positive', method: 'automated', title: 'Penyedia meminta signed upload URL untuk foto PNG yang valid', endpoint: UPLOAD_URL, expectedStatus: 200 },
  { id: 'TC-PF-02', acceptanceCriteria: 'AC-01', type: 'positive', method: 'automated', title: 'Penyedia menyimpan item setelah foto terunggah; item tampil paling atas', endpoint: CREATE, expectedStatus: 201 },
  { id: 'TC-PF-03', acceptanceCriteria: 'AC-01', type: 'positive', method: 'ui', title: 'Alur tambah di modal: pratinjau lokal, unggah saat Simpan, status mengunggah, toast', endpoint: 'UI /provider/dashboard/portfolio', expectedStatus: 200 },
  { id: 'TC-PF-04', acceptanceCriteria: 'AC-02', type: 'positive', method: 'automated', title: 'Pengunjung tanpa login melihat portofolio penyedia, urut terbaru', endpoint: LIST_PUBLIC, expectedStatus: 200 },
  { id: 'TC-PF-05', acceptanceCriteria: 'AC-02', type: 'positive', method: 'automated', title: 'Penyedia tanpa portofolio mengembalikan daftar kosong', endpoint: LIST_PUBLIC, expectedStatus: 200 },
  { id: 'TC-PF-06', acceptanceCriteria: 'AC-02', type: 'negative', method: 'automated', title: 'ID yang bukan penyedia atau tidak terdaftar menghasilkan 404', endpoint: LIST_PUBLIC, expectedStatus: 404, expectedCode: 'PROVIDER_NOT_FOUND' },
  { id: 'TC-PF-07', acceptanceCriteria: 'AC-02', type: 'negative', method: 'automated', title: 'Menolak ID penyedia yang bukan UUID', endpoint: LIST_PUBLIC, expectedStatus: 400, expectedCode: 'INVALID_PROVIDER_ID' },
  { id: 'TC-PF-08', acceptanceCriteria: 'AC-02', type: 'positive', method: 'ui', title: 'Galeri publik dan lightbox: prev/next, panah keyboard, Esc, klik di luar', endpoint: 'UI /preview/providers/[id]/portfolio', expectedStatus: 200 },
  { id: 'TC-PF-09', acceptanceCriteria: 'AC-03', type: 'positive', method: 'automated', title: 'Penyedia mengubah judul dan deskripsi item miliknya', endpoint: UPDATE, expectedStatus: 200 },
  { id: 'TC-PF-10', acceptanceCriteria: 'AC-03', type: 'positive', method: 'automated', title: 'Penyedia mengganti foto; foto lama dihapus setelah data baru tersimpan', endpoint: UPDATE, expectedStatus: 200 },
  { id: 'TC-PF-11', acceptanceCriteria: 'AC-03', type: 'negative', method: 'automated', title: 'Menolak perubahan item yang tidak terdaftar atau ID yang bukan UUID', endpoint: UPDATE, expectedStatus: 404, expectedCode: 'PORTFOLIO_NOT_FOUND' },
  { id: 'TC-PF-12', acceptanceCriteria: 'AC-03', type: 'positive', method: 'ui', title: 'Modal Edit terisi data lama dan konfirmasi buang perubahan', endpoint: 'UI /provider/dashboard/portfolio', expectedStatus: 200 },
  { id: 'TC-PF-13', acceptanceCriteria: 'AC-04', type: 'positive', method: 'automated', title: 'Penyedia menghapus item; baris dan file terhapus permanen', endpoint: REMOVE, expectedStatus: 200 },
  { id: 'TC-PF-14', acceptanceCriteria: 'AC-04', type: 'negative', method: 'automated', title: 'File gagal dihapus: data tetap terhapus dan fileCleanupFailed = true', endpoint: REMOVE, expectedStatus: 200 },
  { id: 'TC-PF-15', acceptanceCriteria: 'AC-04', type: 'negative', method: 'automated', title: 'Menolak penghapusan item yang tidak terdaftar', endpoint: REMOVE, expectedStatus: 404, expectedCode: 'PORTFOLIO_NOT_FOUND' },
  { id: 'TC-PF-16', acceptanceCriteria: 'AC-04', type: 'positive', method: 'manual-sql', title: 'Bucket bersih dari file yatim (blok [L])', endpoint: 'SQL storage.objects + public.provider_portfolios', expectedStatus: 200 },
  { id: 'TC-PF-17', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Backend menolak format selain JPG/PNG saat meminta upload URL', endpoint: UPLOAD_URL, expectedStatus: 400, expectedCode: 'INVALID_FILE_TYPE' },
  { id: 'TC-PF-18', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Backend menolak ukuran lebih dari 5 MB atau tidak valid', endpoint: UPLOAD_URL, expectedStatus: 400, expectedCode: 'FILE_TOO_LARGE' },
  { id: 'TC-PF-19', acceptanceCriteria: 'AC-05', type: 'negative', method: 'manual-storage', title: 'Bucket menolak unggahan langsung yang melanggar MIME atau ukuran', endpoint: 'PUT signed upload URL', expectedStatus: 400 },
  { id: 'TC-PF-20', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Menolak judul tidak valid dan deskripsi lebih dari 500 karakter; file baru dihapus', endpoint: CREATE, expectedStatus: 400, expectedCode: 'VALIDATION_ERROR' },
  { id: 'TC-PF-21', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Backend tidak memercayai path foto dari klien', endpoint: CREATE, expectedStatus: 400, expectedCode: 'INVALID_IMAGE_PATH' },
  { id: 'TC-PF-22', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Menolak path milik sendiri yang file-nya belum diunggah', endpoint: CREATE, expectedStatus: 400, expectedCode: 'UPLOAD_NOT_FOUND' },
  { id: 'TC-PF-23', acceptanceCriteria: 'AC-05', type: 'negative', method: 'automated', title: 'Simpan gagal setelah foto terunggah: file baru dihapus', endpoint: CREATE, expectedStatus: 502 },
  { id: 'TC-PF-24', acceptanceCriteria: 'AC-05', type: 'negative', method: 'ui', title: 'Frontend menolak file dan judul tidak valid sebelum mengunggah', endpoint: 'UI /provider/dashboard/portfolio', expectedStatus: 200 },
  { id: 'TC-PF-25', acceptanceCriteria: 'AC-06', type: 'negative', method: 'automated', title: 'Menolak operasi tulis tanpa sesi atau dengan role customer', endpoint: CREATE, expectedStatus: 403, expectedCode: 'FORBIDDEN' },
  { id: 'TC-PF-26', acceptanceCriteria: 'AC-06', type: 'negative', method: 'automated', title: 'Mencegah Penyedia B mengubah atau menghapus item milik Penyedia A', endpoint: UPDATE, expectedStatus: 403, expectedCode: 'PORTFOLIO_OWNERSHIP_FORBIDDEN' },
  { id: 'TC-PF-27', acceptanceCriteria: 'AC-06', type: 'negative', method: 'automated', title: 'Upload URL mode ganti foto hanya untuk item milik sendiri (400/404/403)', endpoint: UPLOAD_URL, expectedStatus: 403, expectedCode: 'PORTFOLIO_OWNERSHIP_FORBIDDEN' },
  { id: 'TC-PF-28', acceptanceCriteria: 'AC-06', type: 'negative', method: 'manual-sql', title: 'Cek RLS tabel dan storage policy per peran (blok [A] s.d. [K5])', endpoint: 'SQL public.provider_portfolios + storage.objects', expectedStatus: 403 },
  { id: 'TC-PF-29', acceptanceCriteria: 'AC-07', type: 'negative', method: 'automated', title: 'Menolak item ke-21; ganti foto tetap boleh di batas 20', endpoint: CREATE, expectedStatus: 409, expectedCode: 'PORTFOLIO_LIMIT_REACHED' },
  { id: 'TC-PF-30', acceptanceCriteria: 'AC-07', type: 'positive', method: 'automated', title: 'Daftar milik sendiri memuat jumlah slot', endpoint: LIST_MINE, expectedStatus: 200 },
  { id: 'TC-PF-31', acceptanceCriteria: 'AC-07', type: 'positive', method: 'ui', title: 'Menu sidebar, N slot tersisa, dan tombol Tambah nonaktif di batas 20', endpoint: 'UI /provider/dashboard/portfolio', expectedStatus: 200 },
]

const TOTAL = 31
const DOC_PATH = resolve(__dirname, '../../../docs/test-cases/TPR-6-provider-portfolio.md')

describe('TPR-6 / TPR-130: Penyusunan Test Case Portofolio Penyedia Jasa', () => {
  it('Memiliki 31 skenario test case terstruktur (TC-PF-01 s.d. TC-PF-31) dengan ID unik dan berurutan', () => {
    assert.equal(TPR_130_PORTFOLIO_TEST_CASES.length, TOTAL)
    const ids = TPR_130_PORTFOLIO_TEST_CASES.map((tc) => tc.id)
    assert.equal(new Set(ids).size, TOTAL)
    ids.forEach((id, index) => {
      assert.equal(id, `TC-PF-${String(index + 1).padStart(2, '0')}`)
    })
  })

  it('Mencakup seluruh 7 Acceptance Criteria TPR-6 (AC-01 s.d. AC-07)', () => {
    const covered = new Set(TPR_130_PORTFOLIO_TEST_CASES.map((tc) => tc.acceptanceCriteria))
    assert.deepEqual(Array.from(covered).sort(), [
      'AC-01',
      'AC-02',
      'AC-03',
      'AC-04',
      'AC-05',
      'AC-06',
      'AC-07',
    ])
  })

  it('Mencakup skenario positif (13 alur utama) dan negatif (18 validasi, otorisasi, dan kegagalan)', () => {
    const positive = TPR_130_PORTFOLIO_TEST_CASES.filter((tc) => tc.type === 'positive')
    const negative = TPR_130_PORTFOLIO_TEST_CASES.filter((tc) => tc.type === 'negative')
    assert.equal(positive.length, 13)
    assert.equal(negative.length, 18)
  })

  it('Membagi metode: 23 otomatis, 3 cek manual database/storage, 5 UI dengan screenshot', () => {
    const count = (method: PortfolioTestMethod) =>
      TPR_130_PORTFOLIO_TEST_CASES.filter((tc) => tc.method === method).length
    assert.equal(count('automated'), 23)
    assert.equal(count('manual-sql') + count('manual-storage'), 3)
    assert.equal(count('ui'), 5)
  })

  it('Setiap kode error yang diharapkan termasuk kode error PRD/backend TPR-6', () => {
    for (const tc of TPR_130_PORTFOLIO_TEST_CASES) {
      if (tc.expectedCode) {
        assert.ok(
          (PORTFOLIO_ERROR_CODES as readonly string[]).includes(tc.expectedCode),
          `${tc.id} memakai kode tidak dikenal: ${tc.expectedCode}`
        )
      }
    }
  })

  it('Batas pada data uji sama dengan aturan backend (20 item, 5 MB, bucket portfolio)', () => {
    assert.equal(MAX_PORTFOLIO_ITEMS, 20)
    assert.equal(MAX_PORTFOLIO_FILE_SIZE, 5 * 1024 * 1024)
    assert.equal(PORTFOLIO_BUCKET, 'portfolio')
  })

  it('Dokumen test case memuat setiap ID dan AC yang sama dengan spesifikasi ini', () => {
    const doc = readFileSync(DOC_PATH, 'utf8')
    for (const tc of TPR_130_PORTFOLIO_TEST_CASES) {
      const row = new RegExp(`\\| \\*\\*${tc.id}\\*\\* \\| ${tc.acceptanceCriteria} \\|`)
      assert.match(doc, row, `${tc.id} (${tc.acceptanceCriteria}) tidak ada di tabel dokumen`)
    }
  })
})
