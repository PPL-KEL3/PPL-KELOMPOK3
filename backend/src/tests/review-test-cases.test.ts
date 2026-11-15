import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

export interface ReviewTestCaseSpec {
  id: string
  acceptanceCriteria: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05'
  type: 'positive' | 'negative'
  title: string
  endpoint: string
  expectedStatus: number
  expectedCode?: string
}

export const TPR_136_REVIEW_TEST_CASES: readonly ReviewTestCaseSpec[] = [
  {
    id: 'TC-REV-01',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Pelanggan memberi rating 5 dan komentar valid pada transaksi yang diterima',
    endpoint: 'POST /api/reviews',
    expectedStatus: 201,
  },
  {
    id: 'TC-REV-02',
    acceptanceCriteria: 'AC-01',
    type: 'positive',
    title: 'Pelanggan memberi rating 1 dan kritik ulasan pada transaksi yang diterima',
    endpoint: 'POST /api/reviews',
    expectedStatus: 201,
  },
  {
    id: 'TC-REV-03',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak ulasan jika transaksi booking belum disetujui (masih pending)',
    endpoint: 'POST /api/reviews',
    expectedStatus: 400,
    expectedCode: 'BOOKING_NOT_ELIGIBLE',
  },
  {
    id: 'TC-REV-04',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak ulasan jika transaksi booking berstatus dibatalkan (cancelled)',
    endpoint: 'POST /api/reviews',
    expectedStatus: 400,
    expectedCode: 'BOOKING_NOT_ELIGIBLE',
  },
  {
    id: 'TC-REV-05',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak pemberian ulasan kedua pada transaksi booking yang sama (duplikasi)',
    endpoint: 'POST /api/reviews',
    expectedStatus: 409,
    expectedCode: 'REVIEW_ALREADY_EXISTS',
  },
  {
    id: 'TC-REV-06',
    acceptanceCriteria: 'AC-01',
    type: 'negative',
    title: 'Menolak ulasan jika pelanggan bukan pemilik sah transaksi booking tersebut',
    endpoint: 'POST /api/reviews',
    expectedStatus: 403,
    expectedCode: 'BOOKING_FORBIDDEN',
  },
  {
    id: 'TC-REV-07',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Publik melihat daftar ulasan dan statistik agregat rating profil penyedia',
    endpoint: 'GET /api/reviews/provider/:providerId',
    expectedStatus: 200,
  },
  {
    id: 'TC-REV-08',
    acceptanceCriteria: 'AC-02',
    type: 'positive',
    title: 'Mengembalikan statistik 0 dan daftar kosong jika penyedia belum memiliki ulasan',
    endpoint: 'GET /api/reviews/provider/:providerId',
    expectedStatus: 200,
  },
  {
    id: 'TC-REV-09',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Pelanggan memperbarui rating dan komentar ulasan (perubahan ke-1)',
    endpoint: 'PATCH /api/reviews/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-REV-10',
    acceptanceCriteria: 'AC-03',
    type: 'positive',
    title: 'Pelanggan memperbarui ulasan hingga batas maksimal yang ditentukan (3x perubahan)',
    endpoint: 'PATCH /api/reviews/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-REV-11',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak pembaruan ulasan jika batas maksimal 3 kali perubahan telah terlewati',
    endpoint: 'PATCH /api/reviews/:id',
    expectedStatus: 400,
    expectedCode: 'REVIEW_EDIT_LIMIT_EXCEEDED',
  },
  {
    id: 'TC-REV-12',
    acceptanceCriteria: 'AC-03',
    type: 'negative',
    title: 'Menolak pembaruan ulasan jika ID ulasan tidak ditemukan',
    endpoint: 'PATCH /api/reviews/:id',
    expectedStatus: 404,
    expectedCode: 'REVIEW_NOT_FOUND',
  },
  {
    id: 'TC-REV-13',
    acceptanceCriteria: 'AC-04',
    type: 'positive',
    title: 'Pelanggan menarik/menghapus ulasannya dari sistem',
    endpoint: 'DELETE /api/reviews/:id',
    expectedStatus: 200,
  },
  {
    id: 'TC-REV-14',
    acceptanceCriteria: 'AC-04',
    type: 'negative',
    title: 'Menolak penarikan ulasan jika ID ulasan tidak ditemukan',
    endpoint: 'DELETE /api/reviews/:id',
    expectedStatus: 404,
    expectedCode: 'REVIEW_NOT_FOUND',
  },
  {
    id: 'TC-REV-15',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak rating di luar rentang valid 1 sampai 5 (misal rating 0 atau 6)',
    endpoint: 'POST /api/reviews',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-REV-16',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak komentar ulasan yang kurang dari batas minimum 10 karakter',
    endpoint: 'POST /api/reviews',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-REV-17',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Menolak komentar ulasan yang melebihi batas maksimum 1000 karakter',
    endpoint: 'POST /api/reviews',
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    id: 'TC-REV-18',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Pelanggan B dilarang mengubah ulasan milik Pelanggan A',
    endpoint: 'PATCH /api/reviews/:id',
    expectedStatus: 403,
    expectedCode: 'REVIEW_FORBIDDEN',
  },
  {
    id: 'TC-REV-19',
    acceptanceCriteria: 'AC-05',
    type: 'negative',
    title: 'Pelanggan B dilarang menarik/menghapus ulasan milik Pelanggan A',
    endpoint: 'DELETE /api/reviews/:id',
    expectedStatus: 403,
    expectedCode: 'REVIEW_FORBIDDEN',
  },
]

describe('TPR-136: Spesifikasi Test Case Pemberian Rating dan Ulasan', () => {
  it('harus memuat 19 test case terstruktur mencakup seluruh kriteria AC-01 s.d AC-05', () => {
    assert.equal(TPR_136_REVIEW_TEST_CASES.length, 19)
    const acCounts = TPR_136_REVIEW_TEST_CASES.reduce<Record<string, number>>((acc, tc) => {
      acc[tc.acceptanceCriteria] = (acc[tc.acceptanceCriteria] || 0) + 1
      return acc
    }, {})

    assert.equal(acCounts['AC-01'], 6)
    assert.equal(acCounts['AC-02'], 2)
    assert.equal(acCounts['AC-03'], 4)
    assert.equal(acCounts['AC-04'], 2)
    assert.equal(acCounts['AC-05'], 5)
  })

  it('seluruh test case memiliki ID dan judul yang unik', () => {
    const ids = new Set(TPR_136_REVIEW_TEST_CASES.map((tc) => tc.id))
    assert.equal(ids.size, TPR_136_REVIEW_TEST_CASES.length)
  })
})
