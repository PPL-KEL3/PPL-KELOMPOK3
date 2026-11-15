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
import { createPackageRouter } from '../routes/package.routes'
import {
  setPackageStoreForTesting,
  type CreatePackageInput,
  type PackageRow,
  type PackageStore,
  type UpdatePackageInput,
} from '../services/package.service'
import { mapServiceListingDatabaseError } from '../services/service-listing.service'

const PROVIDER_A_ID = '11111111-1111-4111-8111-111111111111'
const PROVIDER_B_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'
const SERVICE_A_ACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const SERVICE_A_INACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const SERVICE_A_EMPTY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const SERVICE_B_ACTIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const PKG_DASAR_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
const PKG_LENGKAP_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'
const PKG_BERKALA_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'
const PKG_DELETED_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
const PKG_INACTIVE_SERVICE_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd5'

type TestRole = 'admin' | 'customer' | 'provider'

interface TestIdentity {
  id: string
  role: TestRole
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
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
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

interface PackageDtoBody {
  id: string
  serviceId: string
  name: string
  description: string | null
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type ListBody = { success: boolean; data: { packages: PackageDtoBody[] } }
type ItemBody = { success: boolean; data: { package: PackageDtoBody; message: string } }
type DeleteBody = { success: boolean; data: { deletedId: string; package: PackageDtoBody } }

function buildTestApp(identity: TestIdentity | null): Express {
  const app = express()

  const mockAuthMiddleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    if (!identity) {
      throw new AppError(401, 'NO_SESSION', 'Kamu belum masuk. Silakan login terlebih dahulu.')
    }

    req.auth = {
      accessToken: `test-token-${identity.id}`,
      remember: false,
      profile: {
        id: identity.id,
        email: `${identity.role}@loka.test`,
        fullName: `Pengguna ${identity.role}`,
        role: identity.role,
        providerVerificationStatus: identity.role === 'provider' ? 'verified' : null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createPackageRouter(mockAuthMiddleware))

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
  options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown }
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
        const rawBody = splitIndex >= 0 ? rawOutput.slice(splitIndex + 4).trim() : ''
        resolve({ status: res.statusCode, body: rawBody ? (JSON.parse(rawBody) as T) : ({} as T) })
      } catch (err) {
        reject(err)
      }
    })

    app(req as unknown as Request, res as unknown as Response)
  })
}

interface ServiceSeed {
  id: string
  provider_id: string
  is_active: boolean
}

const SEED_SERVICES: ServiceSeed[] = [
  { id: SERVICE_A_ACTIVE_ID, provider_id: PROVIDER_A_ID, is_active: true },
  { id: SERVICE_A_INACTIVE_ID, provider_id: PROVIDER_A_ID, is_active: false },
  { id: SERVICE_A_EMPTY_ID, provider_id: PROVIDER_A_ID, is_active: true },
  { id: SERVICE_B_ACTIVE_ID, provider_id: PROVIDER_B_ID, is_active: true },
]

function pkg(
  id: string,
  serviceId: string,
  name: string,
  price: number,
  isActive: boolean,
  createdAt: string,
  deletedAt: string | null = null
): PackageRow {
  return {
    id,
    service_id: serviceId,
    name,
    description: `Deskripsi paket ${name}.`,
    price,
    is_active: isActive,
    deleted_at: deletedAt,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

const SEED_PACKAGES: PackageRow[] = [
  pkg(PKG_LENGKAP_ID, SERVICE_A_ACTIVE_ID, 'Lengkap', 350000, true, '2026-11-11T08:00:00.000Z'),
  pkg(PKG_DASAR_ID, SERVICE_A_ACTIVE_ID, 'Dasar', 150000, true, '2026-11-11T09:00:00.000Z'),
  pkg(PKG_BERKALA_ID, SERVICE_A_ACTIVE_ID, 'Berkala', 500000, false, '2026-11-11T10:00:00.000Z'),
  pkg(
    PKG_DELETED_ID,
    SERVICE_A_ACTIVE_ID,
    'Lama',
    90000,
    true,
    '2026-11-10T08:00:00.000Z',
    '2026-11-10T12:00:00.000Z'
  ),
  pkg(PKG_INACTIVE_SERVICE_ID, SERVICE_A_INACTIVE_ID, 'Tersembunyi', 75000, true, '2026-11-11T08:00:00.000Z'),
]

/**
 * Store in-memory yang meniru perilaku Supabase + RLS migrasi 20261115000000_service_packages:
 * - publik: paket aktif, belum dihapus, dari jasa aktif;
 * - pemilik: semua paket di jasanya (backend memfilter deleted_at);
 * - tulis hanya untuk pemilik jasa; nama unik per jasa (23505).
 */
function createInMemoryPackageStore(): { store: PackageStore; rows: PackageRow[] } {
  const services = SEED_SERVICES.map((row) => ({ ...row }))
  const rows: PackageRow[] = SEED_PACKAGES.map((row) => ({ ...row }))
  let sequence = 1
  let clock = 0

  const userOf = (token: string) => token.replace('test-token-', '')
  const serviceOf = (id: string) => services.find((s) => s.id === id)
  const isOwner = (serviceId: string, token: string) =>
    serviceOf(serviceId)?.provider_id === userOf(token)
  const publicVisible = (row: PackageRow) =>
    row.is_active && !row.deleted_at && Boolean(serviceOf(row.service_id)?.is_active)
  const canSee = (row: PackageRow, token: string) =>
    isOwner(row.service_id, token) || publicVisible(row)
  const sortRows = (list: PackageRow[]) =>
    [...list].sort((a, b) => a.price - b.price || a.created_at.localeCompare(b.created_at))
  const nameTaken = (serviceId: string, name: string, exceptId?: string) =>
    rows.some(
      (r) =>
        r.service_id === serviceId &&
        !r.deleted_at &&
        r.id !== exceptId &&
        r.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
  const nextTimestamp = () => `2026-11-12T00:00:${String(clock++).padStart(2, '0')}.000Z`

  const store: PackageStore = {
    async isServicePubliclyVisible(serviceId) {
      return { data: Boolean(serviceOf(serviceId)?.is_active), error: null }
    },

    async findServiceOwner(serviceId, accessToken) {
      const service = serviceOf(serviceId)
      const visible = service && (service.is_active || service.provider_id === userOf(accessToken))
      return {
        data: visible ? { id: service.id, provider_id: service.provider_id } : null,
        error: null,
      }
    },

    async findPublicByServiceId(serviceId) {
      return {
        data: sortRows(rows.filter((r) => r.service_id === serviceId && publicVisible(r))),
        error: null,
      }
    },

    async findByServiceId(serviceId, accessToken) {
      return {
        data: sortRows(
          rows.filter(
            (r) => r.service_id === serviceId && !r.deleted_at && canSee(r, accessToken)
          )
        ),
        error: null,
      }
    },

    async findById(id, accessToken) {
      const found = rows.find((r) => r.id === id && !r.deleted_at && canSee(r, accessToken))
      return { data: found ? { ...found } : null, error: null }
    },

    async insert(input: CreatePackageInput, accessToken) {
      if (!isOwner(input.serviceId, accessToken)) {
        return { data: null, error: { code: '42501' } }
      }
      if (nameTaken(input.serviceId, input.name)) {
        return { data: null, error: { code: '23505' } }
      }
      const now = nextTimestamp()
      const row: PackageRow = {
        id: `eeeeeeee-eeee-4eee-8eee-${String(sequence++).padStart(12, '0')}`,
        service_id: input.serviceId,
        name: input.name,
        description: input.description,
        price: input.price,
        is_active: input.isActive,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      }
      rows.push(row)
      return { data: { ...row }, error: null }
    },

    async updateById(id, input: UpdatePackageInput, accessToken) {
      const row = rows.find((r) => r.id === id && !r.deleted_at)
      if (!row || !isOwner(row.service_id, accessToken)) return { data: null, error: null }
      if (input.name !== undefined && nameTaken(row.service_id, input.name, id)) {
        return { data: null, error: { code: '23505' } }
      }
      if (input.name !== undefined) row.name = input.name
      if (input.description !== undefined) row.description = input.description
      if (input.price !== undefined) row.price = input.price
      if (input.isActive !== undefined) row.is_active = input.isActive
      row.updated_at = nextTimestamp()
      return { data: { ...row }, error: null }
    },

    async softDeleteById(id, accessToken) {
      const row = rows.find((r) => r.id === id && !r.deleted_at)
      if (!row || !isOwner(row.service_id, accessToken)) return { data: null, error: null }
      row.deleted_at = nextTimestamp()
      row.updated_at = row.deleted_at
      return { data: { ...row }, error: null }
    },
  }

  return { store, rows }
}

const providerA: TestIdentity = { id: PROVIDER_A_ID, role: 'provider' }
const providerB: TestIdentity = { id: PROVIDER_B_ID, role: 'provider' }
const customer: TestIdentity = { id: CUSTOMER_ID, role: 'customer' }

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  serviceId: SERVICE_A_ACTIVE_ID,
  name: 'Premium',
  description: 'Paket lengkap dengan garansi 30 hari.',
  price: 750000,
  isActive: true,
  ...overrides,
})

describe('TPR-5 / TPR-44: Pengujian Alur Pengelolaan Paket & Harga (TC-PKG-01 s.d. TC-PKG-23)', () => {
  let memory: ReturnType<typeof createInMemoryPackageStore>

  beforeEach(() => {
    memory = createInMemoryPackageStore()
    setPackageStoreForTesting(memory.store)
  })

  afterEach(() => {
    setPackageStoreForTesting(null)
  })

  const activeCount = (serviceId: string) =>
    memory.rows.filter((r) => r.service_id === serviceId && !r.deleted_at).length

  it('TC-PKG-01: Penyedia menambah paket aktif ke jasa miliknya (201 Created)', async () => {
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ name: '  Paket   Premium  ' }),
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.package.name, 'Paket Premium')
    assert.equal(res.body.data.package.price, 750000)
    assert.equal(res.body.data.package.isActive, true)
    assert.equal(res.body.data.package.serviceId, SERVICE_A_ACTIVE_ID)
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 4)
  })

  it('TC-PKG-02: Penyedia menambah paket nonaktif dengan deskripsi kosong (201 Created)', async () => {
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ name: 'Hemat', description: '', price: 100000, isActive: false }),
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.package.isActive, false)
    assert.equal(res.body.data.package.description, null)
  })

  it('TC-PKG-03: Penyedia melihat paket aktif + nonaktif jasanya, tanpa yang dihapus, urut termurah (200 OK)', async () => {
    const res = await sendRequest<ListBody>(buildTestApp(providerA), {
      method: 'GET',
      path: `/api/packages/mine?serviceId=${SERVICE_A_ACTIVE_ID}`,
    })

    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.packages.map((p) => p.name),
      ['Dasar', 'Lengkap', 'Berkala']
    )
    assert.ok(res.body.data.packages.some((p) => !p.isActive))
    assert.ok(!res.body.data.packages.some((p) => p.id === PKG_DELETED_ID))
  })

  it('TC-PKG-04: Pengunjung tanpa login hanya melihat paket aktif, urut harga termurah (200 OK)', async () => {
    const res = await sendRequest<ListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}/packages`,
    })

    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.packages.map((p) => [p.name, p.price]),
      [
        ['Dasar', 150000],
        ['Lengkap', 350000],
      ]
    )
  })

  it('TC-PKG-05: Jasa aktif tanpa paket aktif mengembalikan daftar kosong (200 OK)', async () => {
    const res = await sendRequest<ListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services/${SERVICE_A_EMPTY_ID}/packages`,
    })

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.packages, [])
  })

  it('TC-PKG-06: Jasa nonaktif atau tidak terdaftar tidak bisa dilihat publik (404 SERVICE_NOT_FOUND)', async () => {
    const app = buildTestApp(null)

    const inactiveRes = await sendRequest<ApiErrorBody>(app, {
      method: 'GET',
      path: `/api/services/${SERVICE_A_INACTIVE_ID}/packages`,
    })
    assert.equal(inactiveRes.status, 404)
    assert.equal(inactiveRes.body.error.code, 'SERVICE_NOT_FOUND')

    const unknownRes = await sendRequest<ApiErrorBody>(app, {
      method: 'GET',
      path: `/api/services/${UNKNOWN_ID}/packages`,
    })
    assert.equal(unknownRes.status, 404)
    assert.equal(unknownRes.body.error.code, 'SERVICE_NOT_FOUND')
  })

  it('TC-PKG-07: Menolak ID jasa yang bukan UUID pada endpoint publik (400 INVALID_SERVICE_ID)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: '/api/services/abc/packages',
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_SERVICE_ID')
  })

  it('TC-PKG-08: Penyedia mengubah nama, deskripsi, dan harga paket miliknya; updatedAt diperbarui (200 OK)', async () => {
    const before = memory.rows.find((r) => r.id === PKG_LENGKAP_ID)!.updated_at

    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/packages/${PKG_LENGKAP_ID}`,
      body: {
        name: 'Lengkap Plus',
        description: 'Tambal, ganti talang, dan waterproofing.',
        price: 375000,
      },
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.package.name, 'Lengkap Plus')
    assert.equal(res.body.data.package.description, 'Tambal, ganti talang, dan waterproofing.')
    assert.equal(res.body.data.package.price, 375000)
    assert.ok(res.body.data.package.updatedAt > before)
  })

  it('TC-PKG-09: Menolak perubahan paket yang tidak terdaftar (404 PACKAGE_NOT_FOUND)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/packages/${UNKNOWN_ID}`,
      body: { price: 95000 },
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'PACKAGE_NOT_FOUND')
  })

  it('TC-PKG-11: Penyedia menonaktifkan paket dan paket hilang dari endpoint publik (200 OK)', async () => {
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/packages/${PKG_LENGKAP_ID}`,
      body: { isActive: false },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.package.isActive, false)

    const publicRes = await sendRequest<ListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}/packages`,
    })
    assert.ok(!publicRes.body.data.packages.some((p) => p.id === PKG_LENGKAP_ID))
  })

  it('TC-PKG-12: Penyedia mengaktifkan lagi paket nonaktif dan paket kembali tampil publik (200 OK)', async () => {
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/packages/${PKG_BERKALA_ID}`,
      body: { isActive: true },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.package.isActive, true)

    const publicRes = await sendRequest<ListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}/packages`,
    })
    assert.ok(publicRes.body.data.packages.some((p) => p.id === PKG_BERKALA_ID))
  })

  it('TC-PKG-13: Penyedia menghapus paket (soft delete); paket hilang dari daftar, data tetap ada (200 OK)', async () => {
    const res = await sendRequest<DeleteBody>(buildTestApp(providerA), {
      method: 'DELETE',
      path: `/api/packages/${PKG_DASAR_ID}`,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.deletedId, PKG_DASAR_ID)

    const stored = memory.rows.find((r) => r.id === PKG_DASAR_ID)
    assert.ok(stored, 'baris paket tetap ada di tabel')
    assert.ok(stored?.deleted_at, 'deleted_at terisi')

    const mineRes = await sendRequest<ListBody>(buildTestApp(providerA), {
      method: 'GET',
      path: `/api/packages/mine?serviceId=${SERVICE_A_ACTIVE_ID}`,
    })
    assert.ok(!mineRes.body.data.packages.some((p) => p.id === PKG_DASAR_ID))

    const publicRes = await sendRequest<ListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/services/${SERVICE_A_ACTIVE_ID}/packages`,
    })
    assert.ok(!publicRes.body.data.packages.some((p) => p.id === PKG_DASAR_ID))
  })

  it('TC-PKG-14: Menolak penghapusan paket yang sudah dihapus atau tidak terdaftar (404 PACKAGE_NOT_FOUND)', async () => {
    const app = buildTestApp(providerA)

    const deletedRes = await sendRequest<ApiErrorBody>(app, {
      method: 'DELETE',
      path: `/api/packages/${PKG_DELETED_ID}`,
    })
    assert.equal(deletedRes.status, 404)
    assert.equal(deletedRes.body.error.code, 'PACKAGE_NOT_FOUND')

    const unknownRes = await sendRequest<ApiErrorBody>(app, {
      method: 'DELETE',
      path: `/api/packages/${UNKNOWN_ID}`,
    })
    assert.equal(unknownRes.status, 404)
  })

  it('TC-PKG-15: Hapus jasa yang masih punya paket dipetakan ke 409 SERVICE_HAS_PACKAGES', () => {
    const deleteError = mapServiceListingDatabaseError('delete', { code: '23503' })
    assert.equal(deleteError.status, 409)
    assert.equal(deleteError.code, 'SERVICE_HAS_PACKAGES')
    assert.equal(deleteError.message, 'Jasa ini masih punya paket, nonaktifkan saja.')

    // Pemetaan 23503 milik TPR-2 untuk aksi lain tidak berubah.
    const createError = mapServiceListingDatabaseError('create', { code: '23503' })
    assert.equal(createError.code, 'INVALID_CATEGORY_REFERENCE')
  })

  it('TC-PKG-16: Menolak nama paket kosong, kurang dari 3, atau lebih dari 100 karakter (400 VALIDATION_ERROR)', async () => {
    const app = buildTestApp(providerA)
    const cases: Array<[string, string]> = [
      ['   ', 'Nama paket wajib diisi.'],
      ['ab', 'Nama paket minimal 3 karakter.'],
      ['x'.repeat(101), 'Nama paket maksimal 100 karakter.'],
    ]

    for (const [name, message] of cases) {
      const res = await sendRequest<ApiErrorBody>(app, {
        method: 'POST',
        path: '/api/packages',
        body: validPayload({ name }),
      })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
      assert.equal(res.body.error.fields?.name, message)
    }
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 3)
  })

  it('TC-PKG-17: Menolak harga kosong, di luar rentang, atau bukan bilangan bulat (400 VALIDATION_ERROR)', async () => {
    const app = buildTestApp(providerA)
    const cases: Array<[unknown, string]> = [
      ['', 'Harga paket wajib diisi.'],
      [500, 'Harga minimal Rp 1.000.'],
      [100000001, 'Harga maksimal Rp 100.000.000.'],
      [1500.5, 'Harga harus berupa angka bulat dalam Rupiah.'],
    ]

    for (const [price, message] of cases) {
      const res = await sendRequest<ApiErrorBody>(app, {
        method: 'POST',
        path: '/api/packages',
        body: validPayload({ price }),
      })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
      assert.equal(res.body.error.fields?.price, message)
    }
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 3)
  })

  it('TC-PKG-18: Menolak deskripsi lebih dari 500 karakter (400 VALIDATION_ERROR)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ description: 'd'.repeat(501) }),
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    assert.equal(res.body.error.fields?.description, 'Deskripsi maksimal 500 karakter.')
  })

  it('TC-PKG-19: Menolak nama paket duplikat dalam satu jasa, tanpa membedakan huruf besar-kecil (409 DUPLICATE_PACKAGE_NAME)', async () => {
    const app = buildTestApp(providerA)

    const createRes = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ name: 'dasar' }),
    })
    assert.equal(createRes.status, 409)
    assert.equal(createRes.body.error.code, 'DUPLICATE_PACKAGE_NAME')
    assert.equal(createRes.body.error.fields?.name, 'Nama paket sudah dipakai di jasa ini.')

    const updateRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/packages/${PKG_LENGKAP_ID}`,
      body: { name: 'DASAR' },
    })
    assert.equal(updateRes.status, 409)
    assert.equal(updateRes.body.error.code, 'DUPLICATE_PACKAGE_NAME')

    // Nama paket yang sudah di-soft-delete boleh dipakai lagi.
    const reuseRes = await sendRequest<ItemBody>(app, {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ name: 'Lama' }),
    })
    assert.equal(reuseRes.status, 201)
  })

  it('TC-PKG-20: Menolak paket ke-11 dalam satu jasa (409 PACKAGE_LIMIT_REACHED)', async () => {
    const app = buildTestApp(providerA)

    for (let i = 4; i <= 10; i += 1) {
      const res = await sendRequest<ItemBody>(app, {
        method: 'POST',
        path: '/api/packages',
        body: validPayload({ name: `Paket ${i}`, price: 100000 + i }),
      })
      assert.equal(res.status, 201, `paket ke-${i} harus diterima`)
    }
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 10)

    const res = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/packages',
      body: validPayload({ name: 'Paket 11' }),
    })
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'PACKAGE_LIMIT_REACHED')
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 10)
  })

  it('TC-PKG-21: Menolak operasi tulis tanpa sesi (401 NO_SESSION) dan oleh customer (403 FORBIDDEN)', async () => {
    const guestRes = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'POST',
      path: '/api/packages',
      body: validPayload(),
    })
    assert.equal(guestRes.status, 401)
    assert.equal(guestRes.body.error.code, 'NO_SESSION')

    const customerApp = buildTestApp(customer)
    for (const request of [
      { method: 'POST' as const, path: '/api/packages', body: validPayload() },
      { method: 'PATCH' as const, path: `/api/packages/${PKG_DASAR_ID}`, body: { price: 1000 } },
      { method: 'DELETE' as const, path: `/api/packages/${PKG_DASAR_ID}` },
      { method: 'GET' as const, path: `/api/packages/mine?serviceId=${SERVICE_A_ACTIVE_ID}` },
    ]) {
      const res = await sendRequest<ApiErrorBody>(customerApp, request)
      assert.equal(res.status, 403, `${request.method} ${request.path}`)
      assert.equal(res.body.error.code, 'FORBIDDEN')
    }
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 3)
  })

  it('TC-PKG-22: Penyedia B tidak dapat menambah paket ke jasa milik Penyedia A (403 PACKAGE_OWNERSHIP_FORBIDDEN)', async () => {
    const app = buildTestApp(providerB)

    const res = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/packages',
      body: validPayload(),
    })
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'PACKAGE_OWNERSHIP_FORBIDDEN')
    assert.equal(activeCount(SERVICE_A_ACTIVE_ID), 3)

    // Jasa nonaktif milik A tidak terlihat oleh B sama sekali.
    const hiddenRes = await sendRequest<ApiErrorBody>(app, {
      method: 'GET',
      path: `/api/packages/mine?serviceId=${SERVICE_A_INACTIVE_ID}`,
    })
    assert.equal(hiddenRes.status, 404)
    assert.equal(hiddenRes.body.error.code, 'SERVICE_NOT_FOUND')
  })

  it('TC-PKG-23: Penyedia B tidak dapat mengubah, menonaktifkan, atau menghapus paket milik Penyedia A (403 PACKAGE_OWNERSHIP_FORBIDDEN)', async () => {
    const app = buildTestApp(providerB)

    const editRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/packages/${PKG_DASAR_ID}`,
      body: { price: 1000 },
    })
    assert.equal(editRes.status, 403)
    assert.equal(editRes.body.error.code, 'PACKAGE_OWNERSHIP_FORBIDDEN')

    const toggleRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/packages/${PKG_DASAR_ID}`,
      body: { isActive: false },
    })
    assert.equal(toggleRes.status, 403)

    const deleteRes = await sendRequest<ApiErrorBody>(app, {
      method: 'DELETE',
      path: `/api/packages/${PKG_DASAR_ID}`,
    })
    assert.equal(deleteRes.status, 403)
    assert.equal(deleteRes.body.error.code, 'PACKAGE_OWNERSHIP_FORBIDDEN')

    // Paket nonaktif milik A tidak terlihat oleh B, jadi dianggap tidak ada.
    const hiddenRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/packages/${PKG_BERKALA_ID}`,
      body: { price: 1000 },
    })
    assert.equal(hiddenRes.status, 404)

    const original = memory.rows.find((r) => r.id === PKG_DASAR_ID)
    assert.equal(original?.price, 150000)
    assert.equal(original?.is_active, true)
    assert.equal(original?.deleted_at, null)
  })
})
