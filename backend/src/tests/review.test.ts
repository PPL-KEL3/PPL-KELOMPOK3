import assert from 'node:assert/strict'
import http from 'node:http'
import { Duplex } from 'node:stream'
import { afterEach, beforeEach, describe, it } from 'node:test'
import express, {
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import { AppError } from '../lib/errors'
import { sendError } from '../lib/http'
import { createReviewRouter } from '../routes/review.routes'
import {
  calculateReviewStats,
  resetReviewStore,
  setReviewStoreForTesting,
  type BookingReferenceRow,
  type ProviderReviewStats,
  type ReviewDto,
  type ReviewRow,
  type ReviewStore,
} from '../services/review.service'

const CUSTOMER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROVIDER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const SERVICE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const BOOKING_ACCEPTED_A_1 = '11111111-1111-4111-8111-111111111111'
const BOOKING_ACCEPTED_A_2 = '22222222-2222-4222-8222-222222222222'
const BOOKING_PENDING_A = '33333333-3333-4333-8333-333333333333'
const BOOKING_CANCELLED_A = '44444444-4444-4444-8444-444444444444'
const BOOKING_ACCEPTED_B = '55555555-5555-4555-8555-555555555555'
const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999'

interface TestIdentity {
  id: string
  role: 'customer' | 'provider' | 'admin'
}

class MockSocket extends Duplex {
  public chunks: Buffer[] = []
  public remoteAddress = '127.0.0.1'

  _read(): void {}

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    )
    callback(null)
  }
}

interface SimulatedResponse<T> {
  status: number
  body: T
}

interface ApiResponseBody<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

function buildTestApp(identity: TestIdentity | null): Express {
  const app = express()
  app.use(express.json())

  const mockAuthMiddleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    if (!identity) {
      throw new AppError(
        401,
        'NO_SESSION',
        'Kamu belum masuk. Silakan login terlebih dahulu.'
      )
    }

    req.auth = {
      accessToken: `token-${identity.id}`,
      remember: false,
      profile: {
        id: identity.id,
        email: `${identity.role}@loka.test`,
        fullName: `Pengguna ${identity.id.slice(0, 4)}`,
        role: identity.role,
        providerVerificationStatus: null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createReviewRouter(mockAuthMiddleware))

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      sendError(res, err.status, err.code, err.message, err.fields)
      return
    }
    sendError(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.')
  })

  return app
}

async function sendRequest<T>(
  app: Express,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    path: string
    body?: unknown
  }
): Promise<SimulatedResponse<ApiResponseBody<T>>> {
  return new Promise((resolve, reject) => {
    const socket = new MockSocket()
    const req = new http.IncomingMessage(socket as unknown as import('node:net').Socket)
    req.method = options.method
    req.url = options.path
    req.headers = { host: 'localhost', 'content-type': 'application/json' }
    ;(req as unknown as Request).body = options.body ?? {}

    const res = new http.ServerResponse(req)
    res.assignSocket(socket as unknown as import('node:net').Socket)

    res.on('finish', () => {
      try {
        const rawOutput = Buffer.concat(socket.chunks).toString('utf8')
        const splitIndex = rawOutput.indexOf('\r\n\r\n')
        const rawBody =
          splitIndex >= 0 ? rawOutput.slice(splitIndex + 4).trim() : ''
        const parsed = rawBody ? JSON.parse(rawBody) : {}
        resolve({ status: res.statusCode, body: parsed })
      } catch (err) {
        reject(err)
      }
    })

    app(req as unknown as Request, res as unknown as Response)
  })
}

class InMemoryReviewStore implements ReviewStore {
  public bookings: BookingReferenceRow[] = [
    {
      id: BOOKING_ACCEPTED_A_1,
      customer_id: CUSTOMER_A_ID,
      provider_id: PROVIDER_ID,
      service_id: SERVICE_ID,
      status: 'accepted',
    },
    {
      id: BOOKING_ACCEPTED_A_2,
      customer_id: CUSTOMER_A_ID,
      provider_id: PROVIDER_ID,
      service_id: SERVICE_ID,
      status: 'accepted',
    },
    {
      id: BOOKING_PENDING_A,
      customer_id: CUSTOMER_A_ID,
      provider_id: PROVIDER_ID,
      service_id: SERVICE_ID,
      status: 'pending_provider_confirmation',
    },
    {
      id: BOOKING_CANCELLED_A,
      customer_id: CUSTOMER_A_ID,
      provider_id: PROVIDER_ID,
      service_id: SERVICE_ID,
      status: 'cancelled',
    },
    {
      id: BOOKING_ACCEPTED_B,
      customer_id: CUSTOMER_B_ID,
      provider_id: PROVIDER_ID,
      service_id: SERVICE_ID,
      status: 'accepted',
    },
  ]

  public rows: ReviewRow[] = []

  async findBookingById(bookingId: string) {
    const found = this.bookings.find((b) => b.id === bookingId) || null
    return { data: found, error: null }
  }

  async findReviewByBookingId(bookingId: string) {
    const found = this.rows.find((r) => r.booking_id === bookingId) || null
    return { data: found, error: null }
  }

  async findReviewById(id: string) {
    const found = this.rows.find((r) => r.id === id) || null
    return { data: found, error: null }
  }

  async findByProvider(providerId: string) {
    const found = this.rows.filter((r) => r.provider_id === providerId)
    return { data: found, error: null }
  }

  async findByCustomer(customerId: string) {
    const found = this.rows.filter((r) => r.customer_id === customerId)
    return { data: found, error: null }
  }

  async insert(payload: {
    booking_id: string
    customer_id: string
    provider_id: string
    service_id: string
    rating: number
    comment: string
  }) {
    const newRow: ReviewRow = {
      id: `77777777-7777-4777-8777-${String(this.rows.length + 1).padStart(12, '0')}`,
      booking_id: payload.booking_id,
      customer_id: payload.customer_id,
      provider_id: payload.provider_id,
      service_id: payload.service_id,
      rating: payload.rating,
      comment: payload.comment,
      edit_count: 0,
      is_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer: { full_name: 'Pelanggan Uji' },
      services: { name: 'Servis AC Bersih Kilat' },
    }
    this.rows.push(newRow)
    return { data: newRow, error: null }
  }

  async update(
    id: string,
    payload: {
      rating?: number
      comment?: string
      edit_count: number
      is_edited: boolean
    }
  ) {
    const idx = this.rows.findIndex((r) => r.id === id)
    if (idx === -1) return { data: null, error: null }
    const current = this.rows[idx]
    const updated: ReviewRow = {
      ...current,
      ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
      ...(payload.comment !== undefined ? { comment: payload.comment } : {}),
      edit_count: payload.edit_count,
      is_edited: payload.is_edited,
      updated_at: new Date().toISOString(),
    }
    this.rows[idx] = updated
    return { data: updated, error: null }
  }

  async delete(id: string) {
    const idx = this.rows.findIndex((r) => r.id === id)
    if (idx === -1) return { data: null, error: null }
    const removed = this.rows.splice(idx, 1)[0]
    return { data: removed, error: null }
  }
}

describe('TPR-100: Pengujian Fitur Rating dan Ulasan (19 Test Cases)', () => {
  let store: InMemoryReviewStore
  let appCustomerA: Express
  let appCustomerB: Express
  let appPublic: Express

  beforeEach(() => {
    store = new InMemoryReviewStore()
    setReviewStoreForTesting(store)
    appCustomerA = buildTestApp({ id: CUSTOMER_A_ID, role: 'customer' })
    appCustomerB = buildTestApp({ id: CUSTOMER_B_ID, role: 'customer' })
    appPublic = buildTestApp(null)
  })

  afterEach(() => {
    resetReviewStore()
  })

  // AC-01: Pemberian rating & ulasan pada transaksi yang memenuhi syarat
  it('TC-REV-01: Pelanggan memberi rating 5 dan komentar valid pada transaksi yang diterima', async () => {
    const res = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Pelayanan sangat memuaskan, teknisi ramah dan tepat waktu.',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data?.review.rating, 5)
    assert.equal(res.body.data?.review.isEdited, false)
    assert.equal(res.body.data?.review.editCount, 0)
  })

  it('TC-REV-02: Pelanggan memberi rating 1 dan kritik ulasan pada transaksi yang diterima', async () => {
    const res = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_2,
        rating: 1,
        comment: 'Pekerjaan kurang rapi dan datang terlambat tanpa pemberitahuan.',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data?.review.rating, 1)
  })

  it('TC-REV-03: Menolak ulasan jika transaksi booking belum disetujui (masih pending)', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_PENDING_A,
        rating: 4,
        comment: 'Ulasan sebelum pesanan diterima.',
      },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'BOOKING_NOT_ELIGIBLE')
  })

  it('TC-REV-04: Menolak ulasan jika transaksi booking berstatus dibatalkan (cancelled)', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_CANCELLED_A,
        rating: 2,
        comment: 'Booking sudah dibatalkan.',
      },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'BOOKING_NOT_ELIGIBLE')
  })

  it('TC-REV-05: Menolak pemberian ulasan kedua pada transaksi booking yang sama (duplikasi)', async () => {
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Ulasan pertama yang sukses.',
      },
    })

    const dupRes = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 4,
        comment: 'Mencoba submit ulasan kedua kali.',
      },
    })

    assert.equal(dupRes.status, 409)
    assert.equal(dupRes.body.error?.code, 'REVIEW_ALREADY_EXISTS')
  })

  it('TC-REV-06: Menolak ulasan jika pelanggan bukan pemilik sah transaksi booking tersebut', async () => {
    // Pelanggan A mencoba memberi ulasan pada booking milik Pelanggan B
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_B,
        rating: 5,
        comment: 'Mencoba mereview booking milik pengguna lain.',
      },
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'BOOKING_FORBIDDEN')
  })

  // AC-02: Tampil pada profil penyedia & statistik
  it('TC-REV-07: Publik melihat daftar ulasan dan statistik agregat rating profil penyedia', async () => {
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Layanan AC sangat dingin dan wangi.',
      },
    })

    await sendRequest(appCustomerB, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_B,
        rating: 3,
        comment: 'Layanan standar, harga lumayan murah.',
      },
    })

    const res = await sendRequest<{ reviews: ReviewDto[]; stats: ProviderReviewStats }>(
      appPublic,
      {
        method: 'GET',
        path: `/api/reviews/provider/${PROVIDER_ID}`,
      }
    )

    assert.equal(res.status, 200)
    assert.equal(res.body.data?.reviews.length, 2)
    assert.equal(res.body.data?.stats.totalReviews, 2)
    assert.equal(res.body.data?.stats.averageRating, 4) // (5 + 3) / 2 = 4.0
    assert.equal(res.body.data?.stats.ratingDistribution[5], 1)
    assert.equal(res.body.data?.stats.ratingDistribution[3], 1)
  })

  it('TC-REV-08: Mengembalikan statistik 0 dan daftar kosong jika penyedia belum memiliki ulasan', async () => {
    const res = await sendRequest<{ reviews: ReviewDto[]; stats: ProviderReviewStats }>(
      appPublic,
      {
        method: 'GET',
        path: `/api/reviews/provider/${UNKNOWN_UUID}`,
      }
    )

    assert.equal(res.status, 200)
    assert.equal(res.body.data?.stats.totalReviews, 0)
    assert.equal(res.body.data?.stats.averageRating, 0)
    assert.deepEqual(res.body.data?.reviews, [])
  })

  // AC-03: Perubahan ulasan & batas maksimal edit (3x)
  it('TC-REV-09: Pelanggan memperbarui rating dan komentar ulasan (perubahan ke-1)', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 4,
        comment: 'Pengerjaan cukup baik dan cepat selesai.',
      },
    })
    const reviewId = createRes.body.data!.review.id

    const updateRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${reviewId}`,
      body: {
        rating: 5,
        comment: 'Setelah dites seharian ternyata AC sangat dingin sempurna.',
      },
    })

    assert.equal(updateRes.status, 200)
    assert.equal(updateRes.body.data?.review.rating, 5)
    assert.equal(updateRes.body.data?.review.editCount, 1)
    assert.equal(updateRes.body.data?.review.isEdited, true)
  })

  it('TC-REV-10: Pelanggan memperbarui ulasan hingga batas maksimal yang ditentukan (3x perubahan)', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 3,
        comment: 'Komentar awal sebelum direvisi berkali-kali.',
      },
    })
    const reviewId = createRes.body.data!.review.id

    // Edit 1
    await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${reviewId}`,
      body: { comment: 'Komentar revisi pertama dari pelanggan.' },
    })
    // Edit 2
    await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${reviewId}`,
      body: { comment: 'Komentar revisi kedua dari pelanggan.' },
    })
    // Edit 3
    const edit3Res = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${reviewId}`,
      body: { comment: 'Komentar revisi ketiga yang sah dan final.' },
    })

    assert.equal(edit3Res.status, 200)
    assert.equal(edit3Res.body.data?.review.editCount, 3)
  })

  it('TC-REV-11: Menolak pembaruan ulasan jika batas maksimal 3 kali perubahan telah terlewati', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 4,
        comment: 'Ulasan yang akan diedit sampai kuota habis.',
      },
    })
    const reviewId = createRes.body.data!.review.id

    // Edit 1, 2, 3
    for (let i = 1; i <= 3; i++) {
      await sendRequest(appCustomerA, {
        method: 'PATCH',
        path: `/api/reviews/${reviewId}`,
        body: { comment: `Revisi ke-${i} untuk menghabiskan batas edit.` },
      })
    }

    // Edit 4 (Melebihi batas kuota 3x)
    const edit4Res = await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${reviewId}`,
      body: { comment: 'Mencoba revisi ke-4 yang harusnya ditolak sistem.' },
    })

    assert.equal(edit4Res.status, 400)
    assert.equal(edit4Res.body.error?.code, 'REVIEW_EDIT_LIMIT_EXCEEDED')
  })

  it('TC-REV-12: Menolak pembaruan ulasan jika ID ulasan tidak ditemukan', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/reviews/${UNKNOWN_UUID}`,
      body: { comment: 'Mencoba update ulasan fiktif.' },
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error?.code, 'REVIEW_NOT_FOUND')
  })

  // AC-04: Penarikan ulasan
  it('TC-REV-13: Pelanggan menarik/menghapus ulasannya dari sistem', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Ulasan yang ingin ditarik oleh pelanggan.',
      },
    })
    const reviewId = createRes.body.data!.review.id

    const delRes = await sendRequest<{ deletedId: string }>(appCustomerA, {
      method: 'DELETE',
      path: `/api/reviews/${reviewId}`,
    })

    assert.equal(delRes.status, 200)
    assert.equal(delRes.body.data?.deletedId, reviewId)

    const listRes = await sendRequest<{ reviews: ReviewDto[] }>(appCustomerA, {
      method: 'GET',
      path: '/api/reviews/mine',
    })
    assert.equal(listRes.body.data?.reviews.length, 0)
  })

  it('TC-REV-14: Menolak penarikan ulasan jika ID ulasan tidak ditemukan', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'DELETE',
      path: `/api/reviews/${UNKNOWN_UUID}`,
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error?.code, 'REVIEW_NOT_FOUND')
  })

  // AC-05: Validasi rentang rating, komentar, dan isolasi kepemilikan
  it('TC-REV-15: Menolak rating di luar rentang valid 1 sampai 5 (misal rating 0 atau 6)', async () => {
    const resLow = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 0,
        comment: 'Rating 0 bintang tidak valid.',
      },
    })
    assert.equal(resLow.status, 400)
    assert.equal(resLow.body.error?.code, 'VALIDATION_ERROR')

    const resHigh = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 6,
        comment: 'Rating 6 bintang tidak valid.',
      },
    })
    assert.equal(resHigh.status, 400)
    assert.equal(resHigh.body.error?.code, 'VALIDATION_ERROR')
  })

  it('TC-REV-16: Menolak komentar ulasan yang kurang dari batas minimum 10 karakter', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 4,
        comment: 'pendek', // hanya 6 karakter
      },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR')
  })

  it('TC-REV-17: Menolak komentar ulasan yang melebihi batas maksimum 1000 karakter', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 4,
        comment: 'a'.repeat(1001),
      },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR')
  })

  it('TC-REV-18: Pelanggan B dilarang mengubah ulasan milik Pelanggan A', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Ulasan asli milik Pelanggan A.',
      },
    })
    const reviewAId = createRes.body.data!.review.id

    // Pelanggan B mencoba mengubah ulasan milik Pelanggan A
    const res = await sendRequest(appCustomerB, {
      method: 'PATCH',
      path: `/api/reviews/${reviewAId}`,
      body: { comment: 'Ulasan ini dibajak oleh Pelanggan B.' },
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'REVIEW_FORBIDDEN')
  })

  it('TC-REV-19: Pelanggan B dilarang menarik/menghapus ulasan milik Pelanggan A', async () => {
    const createRes = await sendRequest<{ review: ReviewDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/reviews',
      body: {
        bookingId: BOOKING_ACCEPTED_A_1,
        rating: 5,
        comment: 'Ulasan sah milik Pelanggan A.',
      },
    })
    const reviewAId = createRes.body.data!.review.id

    // Pelanggan B mencoba menghapus ulasan milik Pelanggan A
    const res = await sendRequest(appCustomerB, {
      method: 'DELETE',
      path: `/api/reviews/${reviewAId}`,
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'REVIEW_FORBIDDEN')
  })
})
