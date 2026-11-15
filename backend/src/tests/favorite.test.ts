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
import { createFavoriteRouter } from '../routes/favorite.routes'
import {
  resetFavoriteStore,
  setFavoriteStoreForTesting,
  type CreateFavoriteInput,
  type FavoriteDto,
  type FavoriteItemType,
  type FavoriteRow,
  type FavoriteStore,
  type UpdateFavoriteInput,
} from '../services/favorite.service'

const CUSTOMER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CUSTOMER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SERVICE_1_ID = '11111111-1111-4111-8111-111111111111'
const SERVICE_2_ID = '22222222-2222-4222-8222-222222222222'
const PROVIDER_1_ID = '55555555-5555-4555-8555-555555555555'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

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
        fullName: `User ${identity.id.slice(0, 4)}`,
        role: identity.role,
        providerVerificationStatus: null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createFavoriteRouter(mockAuthMiddleware))

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

class InMemoryFavoriteStore implements FavoriteStore {
  public rows: FavoriteRow[] = []

  async findByCustomer(
    customerId: string,
    _accessToken?: string,
    itemType?: FavoriteItemType
  ) {
    let items = this.rows.filter((r) => r.customer_id === customerId)
    if (itemType) {
      items = items.filter((r) => r.item_type === itemType)
    }
    return { data: items, error: null }
  }

  async findById(id: string) {
    const found = this.rows.find((r) => r.id === id) || null
    return { data: found, error: null }
  }

  async findExisting(
    customerId: string,
    itemType: FavoriteItemType,
    targetId: string
  ) {
    const targetKey = itemType === 'service' ? 'service_id' : 'provider_id'
    const found =
      this.rows.find(
        (r) =>
          r.customer_id === customerId &&
          r.item_type === itemType &&
          r[targetKey] === targetId
      ) || null
    return { data: found, error: null }
  }

  async insert(
    customerId: string,
    input: CreateFavoriteInput
  ) {
    const newRow: FavoriteRow = {
      id: `77777777-7777-4777-8777-${String(this.rows.length + 1).padStart(12, '0')}`,
      customer_id: customerId,
      item_type: input.itemType,
      service_id: input.serviceId || null,
      provider_id: input.providerId || null,
      label: input.label || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      services:
        input.itemType === 'service'
          ? {
              id: input.serviceId!,
              name: 'Servis AC Bersih Kilat',
              description: 'Pembersihan AC profesional garansi 30 hari',
              price: 75000,
              is_active: true,
              categories: { name: 'Elektronik & AC' },
              profiles: { full_name: 'Budi Santoso' },
            }
          : null,
      profiles:
        input.itemType === 'provider'
          ? {
              id: input.providerId!,
              full_name: 'Siti Rahma',
              provider_profiles: {
                business_name: 'Berkah Clean Laundry',
                bio: 'Layanan laundry kiloan dan satuan cepat & bersih',
                whatsapp_number: '6281234567890',
                service_area: 'Bandung Kota',
              },
            }
          : null,
    }
    this.rows.push(newRow)
    return { data: newRow, error: null }
  }

  async updateById(
    id: string,
    customerId: string,
    input: UpdateFavoriteInput
  ) {
    const idx = this.rows.findIndex(
      (r) => r.id === id && r.customer_id === customerId
    )
    if (idx === -1) return { data: null, error: null }

    const current = this.rows[idx]
    const updated: FavoriteRow = {
      ...current,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updated_at: new Date().toISOString(),
    }
    this.rows[idx] = updated
    return { data: updated, error: null }
  }

  async deleteById(id: string, customerId: string) {
    const idx = this.rows.findIndex(
      (r) => r.id === id && r.customer_id === customerId
    )
    if (idx === -1) return { data: null, error: null }
    const removed = this.rows.splice(idx, 1)[0]
    return { data: removed, error: null }
  }
}

describe('TPR-96: Pengujian Alur dan Kepemilikan Jasa Favorit (15 Test Cases)', () => {
  let store: InMemoryFavoriteStore
  let appCustomerA: Express
  let appCustomerB: Express

  beforeEach(() => {
    store = new InMemoryFavoriteStore()
    setFavoriteStoreForTesting(store)
    appCustomerA = buildTestApp({ id: CUSTOMER_A_ID, role: 'customer' })
    appCustomerB = buildTestApp({ id: CUSTOMER_B_ID, role: 'customer' })
  })

  afterEach(() => {
    resetFavoriteStore()
  })

  // AC-01: Penambahan favorit
  it('TC-FAV-01: Pelanggan menambahkan layanan jasa ke daftar favorit', async () => {
    const res = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: {
        itemType: 'service',
        serviceId: SERVICE_1_ID,
        label: 'Langganan AC',
        notes: 'Panggil tiap 3 bulan',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data?.favorite.itemType, 'service')
    assert.equal(res.body.data?.favorite.serviceId, SERVICE_1_ID)
    assert.equal(res.body.data?.favorite.target.title, 'Servis AC Bersih Kilat')
  })

  it('TC-FAV-02: Pelanggan menambahkan profil penyedia jasa ke daftar favorit', async () => {
    const res = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: {
        itemType: 'provider',
        providerId: PROVIDER_1_ID,
        label: 'Laundry Favorit',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data?.favorite.itemType, 'provider')
    assert.equal(res.body.data?.favorite.providerId, PROVIDER_1_ID)
    assert.equal(res.body.data?.favorite.target.title, 'Berkah Clean Laundry')
  })

  it('TC-FAV-03: Menolak penambahan duplikasi item yang sudah ada di daftar favorit', async () => {
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })

    const dupRes = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })

    assert.equal(dupRes.status, 409)
    assert.equal(dupRes.body.error?.code, 'FAVORITE_ALREADY_EXISTS')
  })

  it('TC-FAV-04: Menolak penambahan favorit jika tipe atau ID tidak valid', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'invalid_type', serviceId: 'not-a-uuid' },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR')
  })

  // AC-02: Melihat daftar favorit
  it('TC-FAV-05: Pelanggan melihat seluruh daftar item favorit miliknya', async () => {
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'provider', providerId: PROVIDER_1_ID },
    })

    const res = await sendRequest<{ favorites: FavoriteDto[]; count: number }>(appCustomerA, {
      method: 'GET',
      path: '/api/favorites',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data?.count, 2)
  })

  it('TC-FAV-06: Pelanggan memfilter daftar favorit berdasarkan tipe item (service/provider)', async () => {
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    await sendRequest(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'provider', providerId: PROVIDER_1_ID },
    })

    const res = await sendRequest<{ favorites: FavoriteDto[]; count: number }>(appCustomerA, {
      method: 'GET',
      path: '/api/favorites?itemType=service',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data?.count, 1)
    assert.equal(res.body.data?.favorites[0].itemType, 'service')
  })

  it('TC-FAV-07: Mengembalikan daftar kosong jika pelanggan belum memiliki item favorit', async () => {
    const res = await sendRequest<{ favorites: FavoriteDto[]; count: number }>(appCustomerA, {
      method: 'GET',
      path: '/api/favorites',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data?.count, 0)
    assert.deepEqual(res.body.data?.favorites, [])
  })

  // AC-03: Memperbarui label / catatan
  it('TC-FAV-08: Pelanggan memperbarui label dan catatan pribadi item favorit miliknya', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favId = createRes.body.data!.favorite.id

    const updateRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'PATCH',
      path: `/api/favorites/${favId}`,
      body: {
        label: 'AC Rumah Utama',
        notes: 'Sudah langganan sejak 2025',
      },
    })

    assert.equal(updateRes.status, 200)
    assert.equal(updateRes.body.data?.favorite.label, 'AC Rumah Utama')
    assert.equal(updateRes.body.data?.favorite.notes, 'Sudah langganan sejak 2025')
  })

  it('TC-FAV-09: Menolak pembaruan item favorit jika ID tidak ditemukan', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/favorites/${UNKNOWN_ID}`,
      body: { notes: 'Catatan baru' },
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error?.code, 'FAVORITE_NOT_FOUND')
  })

  it('TC-FAV-10: Menolak pembaruan catatan favorit jika melebihi batas 500 karakter', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favId = createRes.body.data!.favorite.id

    const res = await sendRequest(appCustomerA, {
      method: 'PATCH',
      path: `/api/favorites/${favId}`,
      body: { notes: 'a'.repeat(501) },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error?.code, 'VALIDATION_ERROR')
  })

  // AC-04: Menghapus item favorit
  it('TC-FAV-11: Pelanggan menghapus item dari daftar favorit miliknya', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favId = createRes.body.data!.favorite.id

    const delRes = await sendRequest<{ deletedId: string }>(appCustomerA, {
      method: 'DELETE',
      path: `/api/favorites/${favId}`,
    })

    assert.equal(delRes.status, 200)
    assert.equal(delRes.body.data?.deletedId, favId)

    const listRes = await sendRequest<{ count: number }>(appCustomerA, {
      method: 'GET',
      path: '/api/favorites',
    })
    assert.equal(listRes.body.data?.count, 0)
  })

  it('TC-FAV-12: Menolak penghapusan item favorit jika ID tidak ditemukan', async () => {
    const res = await sendRequest(appCustomerA, {
      method: 'DELETE',
      path: `/api/favorites/${UNKNOWN_ID}`,
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error?.code, 'FAVORITE_NOT_FOUND')
  })

  // AC-05: Isolasi Kepemilikan (Ownership Isolation)
  it('TC-FAV-13: Pelanggan tidak dapat melihat item favorit milik pengguna lain', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favAId = createRes.body.data!.favorite.id

    // Customer B tries to view Customer A's favorite
    const res = await sendRequest(appCustomerB, {
      method: 'GET',
      path: `/api/favorites/${favAId}`,
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'FAVORITE_FORBIDDEN')
  })

  it('TC-FAV-14: Pelanggan tidak dapat mengubah label atau catatan favorit milik pengguna lain', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favAId = createRes.body.data!.favorite.id

    // Customer B tries to update Customer A's favorite
    const res = await sendRequest(appCustomerB, {
      method: 'PATCH',
      path: `/api/favorites/${favAId}`,
      body: { notes: 'Diretas oleh user B' },
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'FAVORITE_FORBIDDEN')
  })

  it('TC-FAV-15: Pelanggan tidak dapat menghapus item favorit milik pengguna lain', async () => {
    const createRes = await sendRequest<{ favorite: FavoriteDto }>(appCustomerA, {
      method: 'POST',
      path: '/api/favorites',
      body: { itemType: 'service', serviceId: SERVICE_1_ID },
    })
    const favAId = createRes.body.data!.favorite.id

    // Customer B tries to delete Customer A's favorite
    const res = await sendRequest(appCustomerB, {
      method: 'DELETE',
      path: `/api/favorites/${favAId}`,
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error?.code, 'FAVORITE_FORBIDDEN')
  })
})
