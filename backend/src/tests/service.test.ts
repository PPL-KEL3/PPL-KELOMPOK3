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
import { createServiceRouter } from '../routes/service.routes'
import {
  setServiceListingStoreForTesting,
  type CreateServiceListingInput,
  type ServiceListingRow,
  type ServiceListingStore,
  type UpdateServiceListingInput,
} from '../services/service-listing.service'

const PROVIDER_A_ID = '11111111-1111-4111-8111-111111111111'
const PROVIDER_B_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_AC_ID = '550e8400-e29b-41d4-a716-446655440001'
const CATEGORY_RUMAH_ID = '550e8400-e29b-41d4-a716-446655440002'
const UNKNOWN_CATEGORY_ID = '88888888-8888-4888-8888-888888888888'
const UNKNOWN_SERVICE_ID = '99999999-9999-4999-8999-999999999999'
const SERVICE_A_ACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const SERVICE_A_INACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const SERVICE_B_ACTIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'

type TestRole = 'admin' | 'customer' | 'provider'

interface TestIdentity {
  id: string
  role: TestRole
  verification?: 'verified' | 'pending' | 'rejected' | null
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

interface ApiErrorBody {
  success: false
  error: { code: string; message: string; fields?: Record<string, string> }
}

interface ServiceDtoBody {
  id: string
  providerId: string
  categoryId: string
  categoryName: string
  name: string
  description: string
  price: number
  isActive: boolean
}

function buildTestApp(identity: TestIdentity | null): Express {
  const app = express()

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
      accessToken: `test-token-${identity.id}`,
      remember: false,
      profile: {
        id: identity.id,
        email: `${identity.role}@loka.test`,
        fullName: `Pengguna ${identity.role}`,
        role: identity.role,
        providerVerificationStatus:
          identity.role === 'provider' ? identity.verification ?? 'verified' : null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createServiceRouter(mockAuthMiddleware))

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
): Promise<SimulatedResponse<T>> {
  return new Promise((resolve, reject) => {
    const socket = new MockSocket()
    const req = new http.IncomingMessage(socket as unknown as import('node:net').Socket)
    req.method = options.method
    req.url = options.path
    req.headers = { host: 'localhost' }
    ;(req as unknown as Request).body = options.body ?? {}

    const res = new http.ServerResponse(req)
    res.assignSocket(socket as unknown as import('node:net').Socket)

    res.on('finish', () => {
      try {
        const rawOutput = Buffer.concat(socket.chunks).toString('utf8')
        const splitIndex = rawOutput.indexOf('\r\n\r\n')
        const rawBody =
          splitIndex >= 0 ? rawOutput.slice(splitIndex + 4).trim() : ''
        const parsed = rawBody ? (JSON.parse(rawBody) as T) : ({} as T)
        resolve({ status: res.statusCode, body: parsed })
      } catch (err) {
        reject(err)
      }
    })

    app(req as unknown as Request, res as unknown as Response)
  })
}

const CATEGORY_NAMES: Record<string, string> = {
  [CATEGORY_AC_ID]: 'Servis Elektronik & AC',
  [CATEGORY_RUMAH_ID]: 'Perbaikan & Pertukangan Rumah',
}

function createInMemoryServiceStore(initialRows: ServiceListingRow[]): {
  store: ServiceListingStore
  rows: ServiceListingRow[]
} {
  const rows: ServiceListingRow[] = initialRows.map((row) => ({ ...row }))
  let sequence = 1

  const withCategoryName = (row: ServiceListingRow): ServiceListingRow => ({
    ...row,
    category_name: CATEGORY_NAMES[row.category_id] ?? null,
  })

  const store: ServiceListingStore = {
    async categoryExists(categoryId: string) {
      return { exists: Boolean(CATEGORY_NAMES[categoryId]), error: null }
    },

    async findPublic(filter) {
      const data = rows
        .filter((row) => row.is_active)
        .filter((row) =>
          filter?.categoryId ? row.category_id === filter.categoryId : true
        )
        .map(withCategoryName)
      return { data, error: null }
    },

    async findByProviderId(providerId: string) {
      const data = rows
        .filter((row) => row.provider_id === providerId)
        .map(withCategoryName)
      return { data, error: null }
    },

    async findById(id: string) {
      const found = rows.find((row) => row.id === id)
      return { data: found ? withCategoryName(found) : null, error: null }
    },

    async insert(
      providerId: string,
      providerName: string,
      input: CreateServiceListingInput
    ) {
      const now = '2026-11-10T12:00:00.000Z'
      const newRow: ServiceListingRow = {
        id: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${sequence++}`,
        provider_id: providerId,
        provider_name: providerName,
        category_id: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        is_active: input.isActive ?? true,
        created_at: now,
        updated_at: now,
      }
      rows.push(newRow)
      return { data: withCategoryName(newRow), error: null }
    },

    async updateById(id: string, input: UpdateServiceListingInput) {
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) return { data: null, error: null }

      const current = rows[index]
      const updated: ServiceListingRow = {
        ...current,
        category_id: input.categoryId ?? current.category_id,
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        price: input.price ?? current.price,
        is_active: input.isActive ?? current.is_active,
        updated_at: '2026-11-10T13:00:00.000Z',
      }
      rows[index] = updated
      return { data: withCategoryName(updated), error: null }
    },

    async deleteById(id: string) {
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) return { data: null, error: null }

      const [deleted] = rows.splice(index, 1)
      return { data: withCategoryName(deleted), error: null }
    },
  }

  return { store, rows }
}

const SEED_SERVICES: ServiceListingRow[] = [
  {
    id: SERVICE_A_ACTIVE_ID,
    provider_id: PROVIDER_A_ID,
    provider_name: 'Bengkel Pak Budi',
    category_id: CATEGORY_AC_ID,
    name: 'Servis AC Split & Cuci Unit',
    description: 'Pembersihan evaporator, kondensor, dan pengecekan freon.',
    price: 85000,
    is_active: true,
    created_at: '2026-11-05T08:00:00.000Z',
    updated_at: '2026-11-05T08:00:00.000Z',
  },
  {
    id: SERVICE_A_INACTIVE_ID,
    provider_id: PROVIDER_A_ID,
    provider_name: 'Bengkel Pak Budi',
    category_id: CATEGORY_RUMAH_ID,
    name: 'Perbaikan Talang Air',
    description: 'Penggantian talang bocor dan pembersihan saluran atap.',
    price: 150000,
    is_active: false,
    created_at: '2026-11-06T08:00:00.000Z',
    updated_at: '2026-11-06T08:00:00.000Z',
  },
  {
    id: SERVICE_B_ACTIVE_ID,
    provider_id: PROVIDER_B_ID,
    provider_name: 'Tukang Bu Sari',
    category_id: CATEGORY_RUMAH_ID,
    name: 'Pengecatan Dinding Rumah',
    description: 'Pengecatan ulang dinding interior dan eksterior per meter.',
    price: 45000,
    is_active: true,
    created_at: '2026-11-07T08:00:00.000Z',
    updated_at: '2026-11-07T08:00:00.000Z',
  },
]

const providerA: TestIdentity = { id: PROVIDER_A_ID, role: 'provider', verification: 'verified' }
const providerB: TestIdentity = { id: PROVIDER_B_ID, role: 'provider', verification: 'verified' }

describe('TPR-2 / TPR-32: Pengujian Alur Pengelolaan Jasa (TC-SVC-01 s.d. TC-SVC-15)', () => {
  let memory: ReturnType<typeof createInMemoryServiceStore>

  beforeEach(() => {
    memory = createInMemoryServiceStore(SEED_SERVICES)
    setServiceListingStoreForTesting(memory.store)
  })

  afterEach(() => {
    setServiceListingStoreForTesting(null)
  })

  it('TC-SVC-01: Penyedia terverifikasi dapat menambahkan layanan jasa baru (201 Created)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { service: ServiceDtoBody; message: string }
    }>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/services',
      body: {
        name: '  Servis   Kulkas  Dua Pintu ',
        categoryId: CATEGORY_AC_ID,
        description: 'Pengecekan kompresor, thermostat, dan isi ulang freon kulkas.',
        price: 120000,
        isActive: true,
      },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.service.name, 'Servis Kulkas Dua Pintu')
    assert.equal(response.body.data.service.providerId, PROVIDER_A_ID)
    assert.equal(response.body.data.service.price, 120000)
    assert.equal(response.body.data.service.isActive, true)
    assert.equal(memory.rows.length, 4)
  })

  it('TC-SVC-02: Menolak penambahan layanan oleh penyedia yang belum terverifikasi (403 PROVIDER_NOT_VERIFIED)', async () => {
    const response = await sendRequest<ApiErrorBody>(
      buildTestApp({ id: PROVIDER_A_ID, role: 'provider', verification: 'pending' }),
      {
        method: 'POST',
        path: '/api/services',
        body: {
          name: 'Servis Mesin Cuci',
          categoryId: CATEGORY_AC_ID,
          description: 'Perbaikan mesin cuci tidak berputar dan bocor.',
          price: 90000,
        },
      }
    )

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'PROVIDER_NOT_VERIFIED')
    assert.equal(memory.rows.length, 3)
  })

  it('TC-SVC-03: Pelanggan hanya melihat layanan yang dipublikasikan (200 OK, tanpa layanan nonaktif)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { services: ServiceDtoBody[] }
    }>(buildTestApp(null), { method: 'GET', path: '/api/services' })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.services.length, 2)
    assert.ok(response.body.data.services.every((item) => item.isActive))
    assert.ok(
      !response.body.data.services.some((item) => item.id === SERVICE_A_INACTIVE_ID)
    )
  })

  it('TC-SVC-04: Pelanggan dapat memfilter layanan publik berdasarkan kategori (200 OK)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { services: ServiceDtoBody[] }
    }>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services?categoryId=${CATEGORY_RUMAH_ID}`,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.services.length, 1)
    assert.equal(response.body.data.services[0].id, SERVICE_B_ACTIVE_ID)
    assert.equal(response.body.data.services[0].categoryId, CATEGORY_RUMAH_ID)
  })

  it('TC-SVC-05: Penyedia melihat seluruh layanan miliknya termasuk yang nonaktif (200 OK)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { services: ServiceDtoBody[] }
    }>(buildTestApp(providerA), { method: 'GET', path: '/api/services/mine' })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.services.length, 2)
    assert.ok(
      response.body.data.services.every((item) => item.providerId === PROVIDER_A_ID)
    )
    assert.ok(response.body.data.services.some((item) => !item.isActive))
  })

  it('TC-SVC-06: Penyedia dapat mengubah informasi layanan miliknya (200 OK)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { service: ServiceDtoBody }
    }>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}`,
      body: {
        name: 'Servis AC Split & Isi Freon R32',
        categoryId: CATEGORY_AC_ID,
        description: 'Pembersihan unit indoor outdoor lengkap dengan penambahan freon R32.',
        price: 120000,
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.service.name, 'Servis AC Split & Isi Freon R32')
    assert.equal(response.body.data.service.price, 120000)
  })

  it('TC-SVC-07: Menolak perubahan layanan dengan ID yang tidak terdaftar (404 SERVICE_NOT_FOUND)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/services/${UNKNOWN_SERVICE_ID}`,
      body: { price: 95000 },
    })

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'SERVICE_NOT_FOUND')
  })

  it('TC-SVC-08: Penyedia dapat menonaktifkan layanan dan layanan hilang dari katalog publik (200 OK)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { service: ServiceDtoBody }
    }>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}`,
      body: { isActive: false },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.service.isActive, false)

    const publicRes = await sendRequest<{
      success: boolean
      data: { services: ServiceDtoBody[] }
    }>(buildTestApp(null), { method: 'GET', path: '/api/services' })

    assert.ok(
      !publicRes.body.data.services.some((item) => item.id === SERVICE_A_ACTIVE_ID)
    )
  })

  it('TC-SVC-09: Penyedia dapat menghapus layanan miliknya (200 OK)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { deletedId: string }
    }>(buildTestApp(providerA), {
      method: 'DELETE',
      path: `/api/services/${SERVICE_A_INACTIVE_ID}`,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.deletedId, SERVICE_A_INACTIVE_ID)
    assert.equal(memory.rows.length, 2)
  })

  it('TC-SVC-10: Menolak data wajib yang kosong (400 VALIDATION_ERROR dengan pesan per field)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/services',
      body: { name: '   ', categoryId: '', description: '', price: '' },
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.equal(response.body.error.fields?.name, 'Nama layanan jasa wajib diisi.')
    assert.equal(response.body.error.fields?.categoryId, 'Kategori layanan wajib dipilih.')
    assert.equal(response.body.error.fields?.description, 'Deskripsi layanan wajib diisi.')
    assert.equal(response.body.error.fields?.price, 'Harga layanan wajib diisi.')
    assert.equal(memory.rows.length, 3)
  })

  it('TC-SVC-11: Menolak harga di bawah Rp 1.000 dan harga bukan angka bulat (400 VALIDATION_ERROR)', async () => {
    const app = buildTestApp(providerA)
    const basePayload = {
      name: 'Servis Kipas Angin',
      categoryId: CATEGORY_AC_ID,
      description: 'Perbaikan kipas angin mati dan penggantian kapasitor.',
    }

    const lowRes = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/services',
      body: { ...basePayload, price: 500 },
    })
    assert.equal(lowRes.status, 400)
    assert.equal(lowRes.body.error.fields?.price, 'Harga layanan minimal Rp 1.000.')

    const decimalRes = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/services',
      body: { ...basePayload, price: 25000.5 },
    })
    assert.equal(decimalRes.status, 400)
    assert.equal(
      decimalRes.body.error.fields?.price,
      'Harga layanan harus berupa angka bulat dalam Rupiah.'
    )
  })

  it('TC-SVC-12: Menolak kategori yang tidak terdaftar (400 INVALID_CATEGORY_REFERENCE)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/services',
      body: {
        name: 'Servis Pompa Air',
        categoryId: UNKNOWN_CATEGORY_ID,
        description: 'Perbaikan pompa air tidak menyedot dan bocor.',
        price: 100000,
      },
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'INVALID_CATEGORY_REFERENCE')
    assert.ok(response.body.error.fields?.categoryId)
    assert.equal(memory.rows.length, 3)
  })

  it('TC-SVC-13: Penyedia B tidak dapat mengubah atau menonaktifkan layanan milik Penyedia A (403 SERVICE_OWNERSHIP_FORBIDDEN)', async () => {
    const app = buildTestApp(providerB)

    const editRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}`,
      body: { price: 1000 },
    })
    assert.equal(editRes.status, 403)
    assert.equal(editRes.body.error.code, 'SERVICE_OWNERSHIP_FORBIDDEN')

    const toggleRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}`,
      body: { isActive: false },
    })
    assert.equal(toggleRes.status, 403)

    const original = memory.rows.find((row) => row.id === SERVICE_A_ACTIVE_ID)
    assert.equal(original?.price, 85000)
    assert.equal(original?.is_active, true)
  })

  it('TC-SVC-14: Penyedia B tidak dapat menghapus layanan milik Penyedia A (403 SERVICE_OWNERSHIP_FORBIDDEN)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerB), {
      method: 'DELETE',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}`,
    })

    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'SERVICE_OWNERSHIP_FORBIDDEN')
    assert.equal(memory.rows.length, 3)
  })

  it('TC-SVC-15: Menolak pengelolaan layanan tanpa sesi (401 NO_SESSION) dan oleh customer (403 FORBIDDEN)', async () => {
    const payload = {
      name: 'Layanan Tidak Sah',
      categoryId: CATEGORY_AC_ID,
      description: 'Percobaan menambah layanan tanpa hak akses.',
      price: 50000,
    }

    const guestRes = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'POST',
      path: '/api/services',
      body: payload,
    })
    assert.equal(guestRes.status, 401)
    assert.equal(guestRes.body.error.code, 'NO_SESSION')

    const customerRes = await sendRequest<ApiErrorBody>(
      buildTestApp({ id: CUSTOMER_ID, role: 'customer' }),
      { method: 'POST', path: '/api/services', body: payload }
    )
    assert.equal(customerRes.status, 403)
    assert.equal(customerRes.body.error.code, 'FORBIDDEN')
    assert.equal(memory.rows.length, 3)
  })
})

