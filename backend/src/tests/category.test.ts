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
import { createCategoryRouter } from '../routes/category.routes'
import {
  setCategoryStoreForTesting,
  type CategoryRow,
  type CategoryStore,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '../services/category.service'

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

interface SimulatedResponse<T = Record<string, unknown>> {
  status: number
  body: T
}

function buildTestApp(role: 'admin' | 'customer' | 'provider' | null): Express {
  const app = express()

  const mockAuthMiddleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    if (!role) {
      throw new AppError(
        401,
        'NO_SESSION',
        'Kamu belum masuk. Silakan login terlebih dahulu.'
      )
    }

    req.auth = {
      accessToken: `test-token-${role}`,
      remember: false,
      profile: {
        id: '00000000-0000-4000-8000-000000000001',
        email: `${role}@loka.test`,
        fullName: `Pengguna ${role}`,
        role,
        providerVerificationStatus: role === 'provider' ? 'verified' : null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createCategoryRouter(mockAuthMiddleware))

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      sendError(res, err.status, err.code, err.message, err.fields)
      return
    }
    sendError(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.')
  })

  return app
}

async function sendRequest<T = Record<string, unknown>>(
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

function createInMemoryCategoryStore(initialRows: CategoryRow[]): {
  store: CategoryStore
  rows: CategoryRow[]
  linkedServiceCounts: Map<string, number>
} {
  const rows: CategoryRow[] = initialRows.map((row) => ({ ...row }))
  const linkedServiceCounts = new Map<string, number>()

  for (const row of initialRows) {
    if (typeof row.usage_count === 'number') {
      linkedServiceCounts.set(row.id, row.usage_count)
    }
  }

  let sequence = rows.length + 1

  const store: CategoryStore = {
    async findAll() {
      return {
        data: rows.map((item) => ({
          ...item,
          usage_count: linkedServiceCounts.get(item.id) ?? 0,
        })),
        error: null,
      }
    },

    async findById(id: string) {
      const found = rows.find((item) => item.id === id)
      return {
        data: found
          ? { ...found, usage_count: linkedServiceCounts.get(found.id) ?? 0 }
          : null,
        error: null,
      }
    },

    async countLinkedServices(categoryId: string) {
      return {
        count: linkedServiceCounts.get(categoryId) ?? 0,
        error: null,
      }
    },

    async insert(input: CreateCategoryInput) {
      const now = '2026-11-10T10:00:00.000Z'
      const newRow: CategoryRow = {
        id: `550e8400-e29b-41d4-a716-44665544000${sequence++}`,
        name: input.name,
        description: input.description,
        usage_count: 0,
        created_at: now,
        updated_at: now,
      }
      rows.push(newRow)
      linkedServiceCounts.set(newRow.id, 0)
      return { data: { ...newRow }, error: null }
    },

    async updateById(id: string, input: UpdateCategoryInput) {
      const index = rows.findIndex((item) => item.id === id)
      if (index === -1) {
        return { data: null, error: null }
      }

      const current = rows[index]
      const updated: CategoryRow = {
        ...current,
        name: input.name !== undefined ? input.name : current.name,
        description:
          input.description !== undefined
            ? input.description
            : current.description,
        usage_count: linkedServiceCounts.get(id) ?? 0,
        updated_at: '2026-11-10T11:00:00.000Z',
      }
      rows[index] = updated
      return { data: { ...updated }, error: null }
    },

    async deleteById(id: string) {
      const index = rows.findIndex((item) => item.id === id)
      if (index === -1) {
        return { data: null, error: null }
      }

      const [deleted] = rows.splice(index, 1)
      linkedServiceCounts.delete(id)
      return { data: { ...deleted, usage_count: 0 }, error: null }
    },
  }

  return { store, rows, linkedServiceCounts }
}

const SEED_CATEGORIES: CategoryRow[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Perbaikan & Pertukangan Rumah',
    description: 'Layanan perbaikan atap, cat dinding, dan pertukangan kayu.',
    usage_count: 3,
    created_at: '2026-11-01T08:00:00.000Z',
    updated_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Servis Elektronik & AC',
    description: 'Cuci AC, perbaikan kulkas, dan mesin cuci.',
    usage_count: 0,
    created_at: '2026-11-02T08:00:00.000Z',
    updated_at: '2026-11-02T08:00:00.000Z',
  },
]

describe('TPR-1 / TPR-28: Pengujian Pengelolaan Kategori Jasa (TC-CAT-01 s.d. TC-CAT-14)', () => {
  let memoryStore: ReturnType<typeof createInMemoryCategoryStore>

  beforeEach(() => {
    memoryStore = createInMemoryCategoryStore(SEED_CATEGORIES)
    setCategoryStoreForTesting(memoryStore.store)
  })

  afterEach(() => {
    setCategoryStoreForTesting(null)
  })

  it('TC-CAT-01: Admin dapat menambahkan kategori baru dengan nama dan deskripsi valid (201 Created)', async () => {
    const app = buildTestApp('admin')
    const response = await sendRequest<{
      success: boolean
      data: {
        category: {
          id: string
          name: string
          description: string | null
          usageCount: number
        }
        message: string
      }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: {
        name: 'Perbaikan Atap & Talang',
        description:
          'Jasa perbaikan kebocoran atap dan instalasi talang rumah.',
      },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.category.name, 'Perbaikan Atap & Talang')
    assert.equal(
      response.body.data.category.description,
      'Jasa perbaikan kebocoran atap dan instalasi talang rumah.'
    )
    assert.equal(response.body.data.category.usageCount, 0)
  })

  it('TC-CAT-02: Admin dapat menambahkan kategori baru tanpa deskripsi (description = null)', async () => {
    const app = buildTestApp('admin')
    const response = await sendRequest<{
      success: boolean
      data: { category: { name: string; description: string | null } }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: {
        name: 'Jasa Angkut Barang',
        description: '   ',
      },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.category.name, 'Jasa Angkut Barang')
    assert.equal(response.body.data.category.description, null)
  })

  it('TC-CAT-03: Menampilkan seluruh daftar kategori jasa yang tersimpan (200 OK)', async () => {
    const app = buildTestApp(null)
    const response = await sendRequest<{
      success: boolean
      data: {
        categories: Array<{ id: string; name: string; usageCount: number }>
      }
    }>(app, {
      method: 'GET',
      path: '/api/categories',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.categories.length, 2)
    assert.equal(
      response.body.data.categories[0].name,
      'Perbaikan & Pertukangan Rumah'
    )
    assert.equal(response.body.data.categories[0].usageCount, 3)
  })

  it('TC-CAT-04: Mengembalikan array kosong saat belum ada data kategori (Empty State)', async () => {
    const emptyStore = createInMemoryCategoryStore([])
    setCategoryStoreForTesting(emptyStore.store)

    const app = buildTestApp(null)
    const response = await sendRequest<{
      success: boolean
      data: { categories: unknown[] }
    }>(app, {
      method: 'GET',
      path: '/api/categories',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.deepEqual(response.body.data.categories, [])
  })

  it('TC-CAT-05: Mengambil detail kategori berdasarkan ID valid (200) dan ID tidak ditemukan (404)', async () => {
    const app = buildTestApp(null)

    const okResponse = await sendRequest<{
      success: boolean
      data: { category: { id: string; name: string } }
    }>(app, {
      method: 'GET',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440001',
    })
    assert.equal(okResponse.status, 200)
    assert.equal(
      okResponse.body.data.category.name,
      'Perbaikan & Pertukangan Rumah'
    )

    const notFoundResponse = await sendRequest<{
      success: boolean
      error: { code: string }
    }>(app, {
      method: 'GET',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440999',
    })
    assert.equal(notFoundResponse.status, 404)
    assert.equal(notFoundResponse.body.error.code, 'CATEGORY_NOT_FOUND')
  })

  it('TC-CAT-06: Admin dapat memperbarui nama dan deskripsi kategori yang sudah ada (200 OK)', async () => {
    const app = buildTestApp('admin')
    const response = await sendRequest<{
      success: boolean
      data: {
        category: { id: string; name: string; description: string | null }
      }
    }>(app, {
      method: 'PATCH',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440002',
      body: {
        name: 'Servis AC & Pendingin Ruangan',
        description: 'Perawatan berkala AC, kulkas, dan mesin pendingin.',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(
      response.body.data.category.name,
      'Servis AC & Pendingin Ruangan'
    )
    assert.equal(
      response.body.data.category.description,
      'Perawatan berkala AC, kulkas, dan mesin pendingin.'
    )
  })

  it('TC-CAT-07: Menolak pembaruan kategori dengan ID yang tidak terdaftar (404 CATEGORY_NOT_FOUND)', async () => {
    const app = buildTestApp('admin')
    const response = await sendRequest<{
      success: boolean
      error: { code: string; message: string }
    }>(app, {
      method: 'PATCH',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440999',
      body: {
        name: 'Kategori Baru',
      },
    })

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'CATEGORY_NOT_FOUND')
  })

  it('TC-CAT-08: Menolak deskripsi kategori yang melebihi 350 karakter (400 VALIDATION_ERROR)', async () => {
    const app = buildTestApp('admin')
    const response = await sendRequest<{
      success: boolean
      error: { code: string; fields: { description?: string } }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: {
        name: 'Kategori Valid',
        description: 'a'.repeat(351),
      },
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.equal(
      response.body.error.fields.description,
      'Deskripsi kategori maksimal 350 karakter.'
    )
  })

  it('TC-CAT-09: Menolak nama kategori kosong atau kurang dari 2 karakter (400 VALIDATION_ERROR)', async () => {
    const app = buildTestApp('admin')

    const emptyNameRes = await sendRequest<{
      success: boolean
      error: { code: string; fields: { name?: string } }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: { name: '   ' },
    })

    assert.equal(emptyNameRes.status, 400)
    assert.equal(emptyNameRes.body.error.code, 'VALIDATION_ERROR')
    assert.equal(
      emptyNameRes.body.error.fields.name,
      'Nama kategori wajib diisi.'
    )

    const shortNameRes = await sendRequest<{
      success: boolean
      error: { code: string; fields: { name?: string } }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: { name: 'A' },
    })

    assert.equal(shortNameRes.status, 400)
    assert.equal(shortNameRes.body.error.code, 'VALIDATION_ERROR')
    assert.equal(
      shortNameRes.body.error.fields.name,
      'Nama kategori minimal terdiri dari 2 karakter.'
    )
  })

  it('TC-CAT-10: Menolak penambahan atau pembaruan dengan nama kategori duplikat secara case-insensitive (409 CATEGORY_NAME_EXISTS)', async () => {
    const app = buildTestApp('admin')

    const duplicateCreateRes = await sendRequest<{
      success: boolean
      error: { code: string; fields?: { name?: string } }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: {
        name: '  servis   elektronik & ac ',
        description: 'Duplikat dengan perbedaan kapitalisasi dan spasi.',
      },
    })

    assert.equal(duplicateCreateRes.status, 409)
    assert.equal(duplicateCreateRes.body.error.code, 'CATEGORY_NAME_EXISTS')

    const duplicateUpdateRes = await sendRequest<{
      success: boolean
      error: { code: string }
    }>(app, {
      method: 'PATCH',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440002',
      body: {
        name: 'perbaikan & pertukangan rumah',
      },
    })

    assert.equal(duplicateUpdateRes.status, 409)
    assert.equal(duplicateUpdateRes.body.error.code, 'CATEGORY_NAME_EXISTS')
  })

  it('TC-CAT-11: Admin dapat menghapus kategori yang tidak digunakan oleh layanan jasa (usageCount = 0 -> 200 OK)', async () => {
    const app = buildTestApp('admin')

    const deleteRes = await sendRequest<{
      success: boolean
      data: { deletedId: string; message: string }
    }>(app, {
      method: 'DELETE',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440002',
    })

    assert.equal(deleteRes.status, 200)
    assert.equal(deleteRes.body.success, true)
    assert.equal(
      deleteRes.body.data.deletedId,
      '550e8400-e29b-41d4-a716-446655440002'
    )
    assert.equal(memoryStore.rows.length, 1)
  })

  it('TC-CAT-12: Menolak penghapusan kategori yang masih terhubung ke layanan jasa (usageCount > 0 -> 409 CATEGORY_IN_USE)', async () => {
    const app = buildTestApp('admin')

    const blockedRes = await sendRequest<{
      success: boolean
      error: { code: string; message: string }
    }>(app, {
      method: 'DELETE',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440001',
    })

    assert.equal(blockedRes.status, 409)
    assert.equal(blockedRes.body.success, false)
    assert.equal(blockedRes.body.error.code, 'CATEGORY_IN_USE')
    assert.equal(
      blockedRes.body.error.message,
      'Kategori tidak dapat dihapus karena masih terhubung dengan layanan jasa.'
    )
    assert.equal(memoryStore.rows.length, 2)
  })

  it('TC-CAT-13: Menolak operasi mutasi kategori oleh pengguna yang belum login (401 NO_SESSION)', async () => {
    const app = buildTestApp(null)

    const response = await sendRequest<{
      success: boolean
      error: { code: string }
    }>(app, {
      method: 'POST',
      path: '/api/categories',
      body: { name: 'Kategori Tanpa Login' },
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.error.code, 'NO_SESSION')
  })

  it('TC-CAT-14: Menolak operasi mutasi kategori oleh pengguna ber-role customer atau provider (403 FORBIDDEN)', async () => {
    const customerApp = buildTestApp('customer')
    const customerRes = await sendRequest<{
      success: boolean
      error: { code: string }
    }>(customerApp, {
      method: 'POST',
      path: '/api/categories',
      body: { name: 'Kategori Oleh Customer' },
    })

    assert.equal(customerRes.status, 403)
    assert.equal(customerRes.body.error.code, 'FORBIDDEN')

    const providerApp = buildTestApp('provider')
    const providerRes = await sendRequest<{
      success: boolean
      error: { code: string }
    }>(providerApp, {
      method: 'DELETE',
      path: '/api/categories/550e8400-e29b-41d4-a716-446655440002',
    })

    assert.equal(providerRes.status, 403)
    assert.equal(providerRes.body.error.code, 'FORBIDDEN')
  })
})
