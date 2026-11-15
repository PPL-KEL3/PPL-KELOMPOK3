import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

export interface FavoriteTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05'
  type: 'positive' | 'negative'
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

export const TPR_135_FAVORITE_TEST_CASES: readonly FavoriteTestCaseSpec[] = [
  {
    id: 'TC-FAV-01',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Pelanggan menambahkan layanan jasa ke daftar favorit',
    endpoint: 'POST /api/favorites',
    expectedStatus: 201,
  },
  {
    id: 'TC-FAV-02',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Pelanggan menambahkan profil penyedia jasa ke daftar favorit',
    endpoint: 'POST /api/favorites',
    expectedStatus: 201,
  },
  {
    id: 'TC-FAV-03',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak penambahan duplikasi item yang sudah ada di daftar favorit',
    endpoint: 'POST /api/favorites',
    expectedStatus: 409,
    expectedCode: 'FAVORITE_ALREADY_EXISTS',
  },
  {
    id: 'TC-FAV-04',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak penambahan favorit jika tipe atau ID tidak valid',
    endpoint: 'POST /api/favorites',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-FAV-05',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Pelanggan melihat seluruh daftar item favorit miliknya',
    endpoint: 'GET /api/favorites',
    expectedStatus: 200,
  },
  {
    id: 'TC-FAV-06',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Pelanggan memfilter daftar favorit berdasarkan tipe item (service/provider)',
    endpoint: 'GET /api/favorites?itemType=service',
    expectedStatus: 200,
  },
  {
    id: 'TC-FAV-07',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Mengembalikan daftar kosong jika pelanggan belum memiliki item favorit',
    endpoint: 'GET /api/favorites',
    expectedStatus: 200,
  },
  {
    id: 'TC-FAV-08',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Pelanggan memperbarui label dan catatan pribadi item favorit miliknya',
    endpoint: 'PATCH /api/favorites/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-FAV-09',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak pembaruan item favorit jika ID tidak ditemukan',
    endpoint: 'PATCH /api/favorites/:id',
    expectedStatus: 404,
    expectedCode: 'FAVORITE_NOT_FOUND',
  },
  {
    id: 'TC-FAV-10',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak pembaruan catatan favorit jika melebihi batas 500 karakter',
    endpoint: 'PATCH /api/favorites/:id',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-FAV-11',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Pelanggan menghapus item dari daftar favorit miliknya',
    endpoint: 'DELETE /api/favorites/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-FAV-12',
    acceptanceCriteria: 'AC-04',
    type: 'negative',
    title: 'Menolak penghapusan item favorit jika ID tidak ditemukan',
    endpoint: 'DELETE /api/favorites/:id',
    expectedStatus: 404,
    expectedCode: 'FAVORITE_NOT_FOUND',
  },
  {
    id: 'TC-FAV-13',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Pelanggan tidak dapat melihat item favorit milik pengguna lain',
    endpoint: 'GET /api/favorites/:id',
    expectedStatus: 403,
    expectedCode: 'FAVORITE_FORBIDDEN',
  },
  {
    id: 'TC-FAV-14',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Pelanggan tidak dapat mengubah label atau catatan favorit milik pengguna lain',
    endpoint: 'PATCH /api/favorites/:id',
    expectedStatus: 403,
    expectedCode: 'FAVORITE_FORBIDDEN',
  },
  {
    id: 'TC-FAV-15',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Pelanggan tidak dapat menghapus item favorit milik pengguna lain',
    endpoint: 'DELETE /api/favorites/:id',
    expectedStatus: 403,
    expectedCode: 'FAVORITE_FORBIDDEN',
  },
]

describe('TPR-135: Spesifikasi Test Case Pengelolaan Jasa Favorit', () => {
  it('harus memuat 15 test case terstruktur mencakup AC-01 s.d AC-05', () => {
    assert.equal(TPR_135_FAVORITE_TEST_CASES.length, 15)
    const acCounts = TPR_135_FAVORITE_TEST_CASES.reduce<Record<string, number>>((acc, tc) => {
      acc[tc.acceptanceCriteria] = (acc[tc.acceptanceCriteria] || 0) + 1
      return acc
    }, {})

    assert.equal(acCounts['AC-01'], 4)
    assert.equal(acCounts['AC-02'], 3)
    assert.equal(acCounts['AC-03'], 3)
    assert.equal(acCounts['AC-04'], 2)
    assert.equal(acCounts['AC-05'], 3)
  })

  it('seluruh test case memiliki ID dan judul yang unik', () => {
    const ids = new Set(TPR_135_FAVORITE_TEST_CASES.map((tc) => tc.id))
    assert.equal(ids.size, TPR_135_FAVORITE_TEST_CASES.length)
  })
})
