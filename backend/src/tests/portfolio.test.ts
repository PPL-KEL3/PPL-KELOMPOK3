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
import { createPortfolioRouter } from '../routes/portfolio.routes'
import {
  MAX_PORTFOLIO_FILE_SIZE,
  MAX_PORTFOLIO_ITEMS,
  setPortfolioStoreForTesting,
  type CreatePortfolioInput,
  type PortfolioRow,
  type PortfolioStore,
  type StoredFileInfo,
  type UpdatePortfolioInput,
} from '../services/portfolio.service'

// Pengujian otomatis TPR-6 (TPR-48). Skenario: docs/test-cases/TPR-6-provider-portfolio.md

const PROVIDER_A_ID = '11111111-1111-4111-8111-111111111111'
const PROVIDER_B_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const ITEM_A1_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const ITEM_A2_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const ITEM_A3_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

const PNG = 'image/png'
const STORAGE_HOST = 'https://storage.test'

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

interface PortfolioDtoBody {
  id: string
  providerId: string
  title: string
  description: string | null
  imageUrl: string
  imagePath: string
  createdAt: string
  updatedAt: string
}

type UploadUrlBody = { success: boolean; data: { uploadUrl: string; imagePath: string } }
type ItemBody = { success: boolean; data: { item: PortfolioDtoBody; message: string } }
type PublicListBody = { success: boolean; data: { items: PortfolioDtoBody[] } }
type MineBody = {
  success: boolean
  data: { items: PortfolioDtoBody[]; total: number; limit: number; remainingSlots: number }
}
type DeleteBody = {
  success: boolean
  data: { deletedId: string; fileCleanupFailed: boolean; message: string }
}

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

  app.use('/api', createPortfolioRouter(mockAuthMiddleware))

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

// ---------------------------------------------------------------------------
// Store in-memory: database + storage
// ---------------------------------------------------------------------------

const PROFILES: Record<string, TestRole> = {
  [PROVIDER_A_ID]: 'provider',
  [PROVIDER_B_ID]: 'provider',
  [CUSTOMER_ID]: 'customer',
}

const IMAGE_PATH_FORMAT = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/

function seedPath(providerId: string, n: number): string {
  return `${providerId}/cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, '0')}.png`
}

function item(id: string, providerId: string, title: string, n: number, createdAt: string): PortfolioRow {
  return {
    id,
    provider_id: providerId,
    title,
    description: `Deskripsi ${title}.`,
    image_path: seedPath(providerId, n),
    created_at: createdAt,
    updated_at: createdAt,
  }
}

const SEED_ITEMS: PortfolioRow[] = [
  item(ITEM_A1_ID, PROVIDER_A_ID, 'Perbaikan Atap Bocor', 1, '2026-11-10T08:00:00.000Z'),
  item(ITEM_A2_ID, PROVIDER_A_ID, 'Servis AC Split', 2, '2026-11-10T09:00:00.000Z'),
  item(ITEM_A3_ID, PROVIDER_A_ID, 'Pemasangan Talang Air', 3, '2026-11-10T10:00:00.000Z'),
]

interface MemoryStore {
  store: PortfolioStore
  rows: PortfolioRow[]
  files: Map<string, StoredFileInfo>
  /** Simulasi kegagalan storage/database. */
  failRemove: boolean
  failNextInsert: boolean
}

/**
 * Meniru Supabase + migrasi 20261116000000_provider_portfolios:
 * - tabel: select publik; insert/update/delete hanya pemilik ber-role provider (RLS),
 *   constraint format path (23514) dan path unik (23505);
 * - storage: unggah/lihat/hapus hanya di folder `{uid}/`, unggah hanya role provider.
 */
function createMemoryStore(): MemoryStore {
  const rows: PortfolioRow[] = SEED_ITEMS.map((row) => ({ ...row }))
  const files = new Map<string, StoredFileInfo>(
    SEED_ITEMS.map((row) => [row.image_path, { size: 200_000, contentType: PNG }])
  )
  let sequence = 1
  let clock = 0

  const userOf = (token: string) => token.replace('test-token-', '')
  const isProvider = (uid: string) => PROFILES[uid] === 'provider'
  const ownsFolder = (path: string, token: string) => path.split('/')[0] === userOf(token)
  const nextTimestamp = () => `2026-11-12T00:00:${String(clock++).padStart(2, '0')}.000Z`
  const newest = (list: PortfolioRow[]) =>
    [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const memory: MemoryStore = {
    rows,
    files,
    failRemove: false,
    failNextInsert: false,
    store: {
      async isPublicProvider(providerId) {
        return { data: isProvider(providerId), error: null }
      },

      async findPublicByProviderId(providerId) {
        return { data: newest(rows.filter((r) => r.provider_id === providerId)), error: null }
      },

      async findByProviderId(providerId) {
        return { data: newest(rows.filter((r) => r.provider_id === providerId)), error: null }
      },

      async findById(id) {
        const found = rows.find((r) => r.id === id)
        return { data: found ? { ...found } : null, error: null }
      },

      async insert(providerId, input: CreatePortfolioInput, accessToken) {
        const uid = userOf(accessToken)
        if (providerId !== uid || !isProvider(uid)) {
          return { data: null, error: { code: '42501' } }
        }
        if (memory.failNextInsert) {
          memory.failNextInsert = false
          return { data: null, error: { code: 'XX000' } }
        }
        if (
          !IMAGE_PATH_FORMAT.test(input.imagePath) ||
          input.imagePath.split('/')[0] !== providerId
        ) {
          return { data: null, error: { code: '23514' } }
        }
        if (rows.some((r) => r.image_path === input.imagePath)) {
          return { data: null, error: { code: '23505' } }
        }
        const now = nextTimestamp()
        const row: PortfolioRow = {
          id: `eeeeeeee-eeee-4eee-8eee-${String(sequence++).padStart(12, '0')}`,
          provider_id: providerId,
          title: input.title,
          description: input.description,
          image_path: input.imagePath,
          created_at: now,
          updated_at: now,
        }
        rows.push(row)
        return { data: { ...row }, error: null }
      },

      async updateById(id, input: UpdatePortfolioInput, accessToken) {
        const uid = userOf(accessToken)
        const row = rows.find((r) => r.id === id)
        if (!row || row.provider_id !== uid || !isProvider(uid)) return { data: null, error: null }
        if (input.title !== undefined) row.title = input.title
        if (input.description !== undefined) row.description = input.description
        if (input.imagePath !== undefined) row.image_path = input.imagePath
        row.updated_at = nextTimestamp()
        return { data: { ...row }, error: null }
      },

      async deleteById(id, accessToken) {
        const uid = userOf(accessToken)
        const index = rows.findIndex((r) => r.id === id)
        if (index < 0 || rows[index].provider_id !== uid || !isProvider(uid)) {
          return { data: null, error: null }
        }
        const [removed] = rows.splice(index, 1)
        return { data: removed, error: null }
      },

      async createSignedUploadUrl(path, accessToken) {
        if (!ownsFolder(path, accessToken) || !isProvider(userOf(accessToken))) {
          return { data: null, error: { code: 'STORAGE_403' } }
        }
        return { data: `${STORAGE_HOST}/upload/sign/portfolio/${path}?token=t`, error: null }
      },

      async findFile(path, accessToken) {
        if (!ownsFolder(path, accessToken)) return { data: null, error: null }
        const file = files.get(path)
        return { data: file ? { ...file } : null, error: null }
      },

      async removeFiles(paths, accessToken) {
        if (memory.failRemove) return { data: [], error: null }
        const removed: string[] = []
        for (const path of paths) {
          if (ownsFolder(path, accessToken) && files.delete(path)) removed.push(path)
        }
        return { data: removed, error: null }
      },

      publicUrl(path) {
        return `${STORAGE_HOST}/object/public/portfolio/${path}`
      },
    },
  }

  return memory
}

const providerA: TestIdentity = { id: PROVIDER_A_ID, role: 'provider' }
const providerB: TestIdentity = { id: PROVIDER_B_ID, role: 'provider' }
const customer: TestIdentity = { id: CUSTOMER_ID, role: 'customer' }

const uploadMeta = (overrides: Record<string, unknown> = {}) => ({
  fileName: 'atap.png',
  contentType: PNG,
  size: 245_760,
  ...overrides,
})

describe('TPR-6 / TPR-48: Pengujian Pengelolaan Portofolio Penyedia Jasa (otomatis)', () => {
  let memory: MemoryStore

  beforeEach(() => {
    memory = createMemoryStore()
    setPortfolioStoreForTesting(memory.store)
  })

  afterEach(() => {
    setPortfolioStoreForTesting(null)
  })

  /** Meminta upload URL lalu "mengunggah" file ke storage tiruan (seperti PUT dari browser). */
  async function uploadAs(
    identity: TestIdentity,
    overrides: Record<string, unknown> = {},
    file: StoredFileInfo = { size: 245_760, contentType: PNG }
  ): Promise<string> {
    const res = await sendRequest<UploadUrlBody>(buildTestApp(identity), {
      method: 'POST',
      path: '/api/providers/me/portfolio/upload-url',
      body: uploadMeta(overrides),
    })
    assert.equal(res.status, 200, 'upload-url harus berhasil sebagai persiapan')
    memory.files.set(res.body.data.imagePath, file)
    return res.body.data.imagePath
  }

  function seedToLimit(providerId: string): void {
    for (let n = memory.rows.length + 1; n <= MAX_PORTFOLIO_ITEMS; n += 1) {
      const row = item(
        `ffffffff-ffff-4fff-8fff-${String(n).padStart(12, '0')}`,
        providerId,
        `Item ${n}`,
        100 + n,
        `2026-11-09T00:00:${String(n).padStart(2, '0')}.000Z`
      )
      memory.rows.push(row)
      memory.files.set(row.image_path, { size: 100_000, contentType: PNG })
    }
  }

  // ------------------------------ AC-01 Tambah ------------------------------

  it('TC-PF-01: Penyedia meminta signed upload URL untuk foto PNG yang valid (200 OK)', async () => {
    const res = await sendRequest<UploadUrlBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio/upload-url',
      body: uploadMeta(),
    })

    assert.equal(res.status, 200)
    assert.ok(res.body.data.uploadUrl.startsWith(STORAGE_HOST))
    assert.match(
      res.body.data.imagePath,
      new RegExp(`^${PROVIDER_A_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`)
    )
    assert.ok(!res.body.data.imagePath.includes('atap'), 'nama asli file tidak dipakai di path')
  })

  it('TC-PF-02: Penyedia menyimpan item setelah foto terunggah; item tampil paling atas (201 Created)', async () => {
    const imagePath = await uploadAs(providerA)
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio',
      body: { title: '  Perbaikan   Atap Bocor ', description: 'Ganti genteng pecah.', imagePath },
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.item.title, 'Perbaikan Atap Bocor')
    assert.equal(res.body.data.item.imagePath, imagePath)
    assert.equal(res.body.data.item.imageUrl, `${STORAGE_HOST}/object/public/portfolio/${imagePath}`)
    assert.equal(res.body.data.message, 'Portofolio baru berhasil ditambahkan.')

    const mine = await sendRequest<MineBody>(buildTestApp(providerA), {
      method: 'GET',
      path: '/api/providers/me/portfolio',
    })
    assert.equal(mine.body.data.items[0].id, res.body.data.item.id)
  })

  // ------------------------------ AC-02 Publik ------------------------------

  it('TC-PF-04: Pengunjung tanpa login melihat portofolio penyedia, urut terbaru (200 OK)', async () => {
    const res = await sendRequest<PublicListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_A_ID}/portfolio`,
    })

    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.items.map((i) => i.id),
      [ITEM_A3_ID, ITEM_A2_ID, ITEM_A1_ID]
    )
  })

  it('TC-PF-05: Penyedia tanpa portofolio mengembalikan daftar kosong (200 OK)', async () => {
    const res = await sendRequest<PublicListBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_B_ID}/portfolio`,
    })

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.items, [])
  })

  it('TC-PF-06: ID yang bukan penyedia atau tidak terdaftar menghasilkan 404 PROVIDER_NOT_FOUND', async () => {
    for (const id of [UNKNOWN_ID, CUSTOMER_ID]) {
      const res = await sendRequest<ApiErrorBody>(buildTestApp(null), {
        method: 'GET',
        path: `/api/providers/${id}/portfolio`,
      })
      assert.equal(res.status, 404)
      assert.equal(res.body.error.code, 'PROVIDER_NOT_FOUND')
    }
  })

  it('TC-PF-07: Menolak ID penyedia yang bukan UUID (400 INVALID_PROVIDER_ID)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: '/api/providers/bukan-uuid/portfolio',
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'INVALID_PROVIDER_ID')
  })

  // ------------------------------ AC-03 Ubah --------------------------------

  it('TC-PF-09: Penyedia mengubah judul dan deskripsi item miliknya (200 OK)', async () => {
    const before = memory.rows.find((r) => r.id === ITEM_A1_ID)!
    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/providers/me/portfolio/${ITEM_A1_ID}`,
      body: { title: 'Pengecatan Ulang Ruang Tamu', description: 'Dua lapis, hasil rapi.' },
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.item.title, 'Pengecatan Ulang Ruang Tamu')
    assert.equal(res.body.data.item.description, 'Dua lapis, hasil rapi.')
    assert.equal(res.body.data.item.imagePath, before.image_path)
    assert.ok(res.body.data.item.updatedAt > before.created_at)
  })

  it('TC-PF-10: Penyedia mengganti foto; foto lama dihapus setelah data baru tersimpan (200 OK)', async () => {
    const oldPath = seedPath(PROVIDER_A_ID, 1)
    const newPath = await uploadAs(providerA, { purpose: 'replace', portfolioId: ITEM_A1_ID })

    const res = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/providers/me/portfolio/${ITEM_A1_ID}`,
      body: { imagePath: newPath },
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.item.imagePath, newPath)
    assert.ok(!memory.files.has(oldPath), 'foto lama terhapus')
    assert.ok(memory.files.has(newPath), 'foto baru tetap ada')

    // Gagal hapus foto lama tidak menggagalkan respons.
    memory.failRemove = true
    const another = await uploadAs(providerA, { purpose: 'replace', portfolioId: ITEM_A1_ID })
    const again = await sendRequest<ItemBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/providers/me/portfolio/${ITEM_A1_ID}`,
      body: { imagePath: another },
    })
    assert.equal(again.status, 200)
    assert.equal(again.body.data.item.imagePath, another)
  })

  it('TC-PF-11: Menolak perubahan item tidak terdaftar (404) atau ID bukan UUID (400)', async () => {
    const missing = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: `/api/providers/me/portfolio/${UNKNOWN_ID}`,
      body: { title: 'Judul baru' },
    })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.code, 'PORTFOLIO_NOT_FOUND')

    const invalid = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PATCH',
      path: '/api/providers/me/portfolio/bukan-uuid',
      body: { title: 'Judul baru' },
    })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.error.code, 'INVALID_PORTFOLIO_ID')
  })

  // ------------------------------ AC-04 Hapus -------------------------------

  it('TC-PF-13: Penyedia menghapus item; baris dan file terhapus permanen (200 OK)', async () => {
    const path = seedPath(PROVIDER_A_ID, 2)
    const res = await sendRequest<DeleteBody>(buildTestApp(providerA), {
      method: 'DELETE',
      path: `/api/providers/me/portfolio/${ITEM_A2_ID}`,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.deletedId, ITEM_A2_ID)
    assert.equal(res.body.data.fileCleanupFailed, false)
    assert.ok(!memory.rows.some((r) => r.id === ITEM_A2_ID))
    assert.ok(!memory.files.has(path))
  })

  it('TC-PF-14: File gagal dihapus: data tetap terhapus dan fileCleanupFailed = true (200 OK)', async () => {
    memory.failRemove = true
    const res = await sendRequest<DeleteBody>(buildTestApp(providerA), {
      method: 'DELETE',
      path: `/api/providers/me/portfolio/${ITEM_A2_ID}`,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.fileCleanupFailed, true)
    assert.equal(res.body.data.message, 'Item terhapus, file masih tertinggal.')
    assert.ok(!memory.rows.some((r) => r.id === ITEM_A2_ID))
  })

  it('TC-PF-15: Menolak penghapusan item yang tidak terdaftar (404 PORTFOLIO_NOT_FOUND)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'DELETE',
      path: `/api/providers/me/portfolio/${UNKNOWN_ID}`,
    })

    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'PORTFOLIO_NOT_FOUND')
  })

  // ------------------------------ AC-05 Validasi ----------------------------

  it('TC-PF-17: Backend menolak format selain JPG/PNG saat meminta upload URL (400 INVALID_FILE_TYPE)', async () => {
    for (const meta of [
      { fileName: 'a.gif', contentType: 'image/gif', size: 100 },
      { fileName: 'a.png', contentType: 'image/jpeg', size: 100 },
      { fileName: 'dokumen.pdf', contentType: 'application/pdf', size: 100 },
    ]) {
      const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
        method: 'POST',
        path: '/api/providers/me/portfolio/upload-url',
        body: meta,
      })
      assert.equal(res.status, 400, meta.fileName)
      assert.equal(res.body.error.code, 'INVALID_FILE_TYPE')
      assert.equal(res.body.error.fields?.file, 'Format foto harus JPG atau PNG.')
    }
  })

  it('TC-PF-18: Backend menolak ukuran lebih dari 5 MB (FILE_TOO_LARGE) atau tidak valid (VALIDATION_ERROR)', async () => {
    const tooLarge = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio/upload-url',
      body: uploadMeta({ size: MAX_PORTFOLIO_FILE_SIZE + 1 }),
    })
    assert.equal(tooLarge.status, 400)
    assert.equal(tooLarge.body.error.code, 'FILE_TOO_LARGE')

    for (const size of [0, -1, 1.5, '1000']) {
      const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
        method: 'POST',
        path: '/api/providers/me/portfolio/upload-url',
        body: uploadMeta({ size }),
      })
      assert.equal(res.status, 400, `size ${String(size)}`)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
      assert.ok(res.body.error.fields?.file)
    }

    // File asli di bucket yang ternyata lebih dari 5 MB juga ditolak saat simpan.
    const imagePath = await uploadAs(providerA, {}, { size: MAX_PORTFOLIO_FILE_SIZE + 10, contentType: PNG })
    const save = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio',
      body: { title: 'Foto besar', imagePath },
    })
    assert.equal(save.status, 400)
    assert.equal(save.body.error.code, 'FILE_TOO_LARGE')
    assert.ok(!memory.files.has(imagePath), 'file yang melanggar batas dihapus')
  })

  it('TC-PF-20: Menolak judul tidak valid dan deskripsi > 500 karakter; file baru dihapus (400 VALIDATION_ERROR)', async () => {
    const cases: { body: Record<string, unknown>; field: 'title' | 'description'; message: string }[] = [
      { body: { title: '   ' }, field: 'title', message: 'Judul wajib diisi.' },
      { body: { title: 'ab' }, field: 'title', message: 'Judul minimal 3 karakter.' },
      { body: { title: 'a'.repeat(101) }, field: 'title', message: 'Judul maksimal 100 karakter.' },
      {
        body: { title: 'Judul valid', description: 'x'.repeat(501) },
        field: 'description',
        message: 'Deskripsi maksimal 500 karakter.',
      },
    ]

    for (const tc of cases) {
      const imagePath = await uploadAs(providerA)
      const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
        method: 'POST',
        path: '/api/providers/me/portfolio',
        body: { ...tc.body, imagePath },
      })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
      assert.equal(res.body.error.fields?.[tc.field], tc.message)
      assert.ok(!memory.files.has(imagePath), 'file yang terlanjur diunggah dihapus')
    }
    assert.equal(memory.rows.length, SEED_ITEMS.length)
  })

  it('TC-PF-21: Backend tidak memercayai path foto dari klien (400 INVALID_IMAGE_PATH)', async () => {
    const existingPath = seedPath(PROVIDER_A_ID, 1)
    for (const imagePath of [
      `${PROVIDER_B_ID}/cccccccc-cccc-4ccc-8ccc-000000000099.png`,
      `${PROVIDER_A_ID}/../x.png`,
      `${PROVIDER_A_ID}/cccccccc-cccc-4ccc-8ccc-000000000099.gif`,
      'foto.png',
      existingPath,
    ]) {
      const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
        method: 'POST',
        path: '/api/providers/me/portfolio',
        body: { title: 'Judul valid', imagePath },
      })
      assert.equal(res.status, 400, imagePath)
      assert.equal(res.body.error.code, 'INVALID_IMAGE_PATH')
    }
    assert.ok(memory.files.has(existingPath), 'file milik item lain tidak terhapus')
    assert.equal(memory.rows.length, SEED_ITEMS.length)
  })

  it('TC-PF-22: Menolak path milik sendiri yang file-nya belum diunggah (400 UPLOAD_NOT_FOUND)', async () => {
    const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio',
      body: {
        title: 'Judul valid',
        imagePath: `${PROVIDER_A_ID}/11111111-1111-4111-8111-111111111111.png`,
      },
    })

    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'UPLOAD_NOT_FOUND')
  })

  it('TC-PF-23: Simpan gagal setelah foto terunggah: file baru dihapus (502)', async () => {
    const imagePath = await uploadAs(providerA)
    memory.failNextInsert = true

    const res = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio',
      body: { title: 'Judul valid', imagePath },
    })

    assert.equal(res.status, 502)
    assert.equal(res.body.error.code, 'PORTFOLIO_SERVICE_ERROR')
    assert.ok(!memory.files.has(imagePath), 'file baru dihapus')
    for (const row of SEED_ITEMS) {
      assert.ok(memory.files.has(row.image_path), 'file item lain tidak disentuh')
    }
  })

  // ------------------------------ AC-06 Hak akses ---------------------------

  it('TC-PF-25: Menolak operasi tulis tanpa sesi (401 NO_SESSION) atau dengan role customer (403 FORBIDDEN)', async () => {
    const requests = [
      { method: 'POST' as const, path: '/api/providers/me/portfolio/upload-url', body: uploadMeta() },
      {
        method: 'POST' as const,
        path: '/api/providers/me/portfolio',
        body: { title: 'Judul valid', imagePath: seedPath(CUSTOMER_ID, 1) },
      },
      { method: 'GET' as const, path: '/api/providers/me/portfolio' },
      { method: 'DELETE' as const, path: `/api/providers/me/portfolio/${ITEM_A1_ID}` },
    ]

    for (const request of requests) {
      const guest = await sendRequest<ApiErrorBody>(buildTestApp(null), request)
      assert.equal(guest.status, 401, `${request.method} ${request.path}`)
      assert.equal(guest.body.error.code, 'NO_SESSION')

      const asCustomer = await sendRequest<ApiErrorBody>(buildTestApp(customer), request)
      assert.equal(asCustomer.status, 403, `${request.method} ${request.path}`)
      assert.equal(asCustomer.body.error.code, 'FORBIDDEN')
    }
    assert.equal(memory.rows.length, SEED_ITEMS.length)
  })

  it('TC-PF-26: Mencegah Penyedia B mengubah atau menghapus item milik Penyedia A (403)', async () => {
    const patch = await sendRequest<ApiErrorBody>(buildTestApp(providerB), {
      method: 'PATCH',
      path: `/api/providers/me/portfolio/${ITEM_A1_ID}`,
      body: { title: 'Dibajak' },
    })
    assert.equal(patch.status, 403)
    assert.equal(patch.body.error.code, 'PORTFOLIO_OWNERSHIP_FORBIDDEN')

    const remove = await sendRequest<ApiErrorBody>(buildTestApp(providerB), {
      method: 'DELETE',
      path: `/api/providers/me/portfolio/${ITEM_A1_ID}`,
    })
    assert.equal(remove.status, 403)
    assert.equal(remove.body.error.code, 'PORTFOLIO_OWNERSHIP_FORBIDDEN')

    const row = memory.rows.find((r) => r.id === ITEM_A1_ID)
    assert.equal(row?.title, 'Perbaikan Atap Bocor')
    assert.ok(memory.files.has(seedPath(PROVIDER_A_ID, 1)))
  })

  it('TC-PF-27: Upload URL mode ganti foto hanya untuk item milik sendiri (400/404/403)', async () => {
    const send = (body: Record<string, unknown>) =>
      sendRequest<ApiErrorBody>(buildTestApp(providerB), {
        method: 'POST',
        path: '/api/providers/me/portfolio/upload-url',
        body: uploadMeta({ purpose: 'replace', ...body }),
      })

    const missing = await send({})
    assert.equal(missing.status, 400)
    assert.equal(missing.body.error.code, 'INVALID_PORTFOLIO_ID')

    const invalid = await send({ portfolioId: 'bukan-uuid' })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.error.code, 'INVALID_PORTFOLIO_ID')

    const unknown = await send({ portfolioId: UNKNOWN_ID })
    assert.equal(unknown.status, 404)
    assert.equal(unknown.body.error.code, 'PORTFOLIO_NOT_FOUND')

    const othersItem = await send({ portfolioId: ITEM_A1_ID })
    assert.equal(othersItem.status, 403)
    assert.equal(othersItem.body.error.code, 'PORTFOLIO_OWNERSHIP_FORBIDDEN')
    assert.equal((othersItem.body as unknown as UploadUrlBody).data, undefined)
  })

  // ------------------------------ AC-07 Batas -------------------------------

  it('TC-PF-29: Menolak item ke-21 (409); ganti foto tetap boleh di batas 20', async () => {
    const imagePath = await uploadAs(providerA)
    seedToLimit(PROVIDER_A_ID)
    assert.equal(memory.rows.length, MAX_PORTFOLIO_ITEMS)

    const url = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio/upload-url',
      body: uploadMeta(),
    })
    assert.equal(url.status, 409)
    assert.equal(url.body.error.code, 'PORTFOLIO_LIMIT_REACHED')

    const save = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio',
      body: { title: 'Item ke-21', imagePath },
    })
    assert.equal(save.status, 409)
    assert.equal(save.body.error.code, 'PORTFOLIO_LIMIT_REACHED')
    assert.ok(!memory.files.has(imagePath), 'file item ke-21 dihapus')
    assert.equal(memory.rows.length, MAX_PORTFOLIO_ITEMS)

    const replace = await sendRequest<UploadUrlBody>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/portfolio/upload-url',
      body: uploadMeta({ purpose: 'replace', portfolioId: ITEM_A1_ID }),
    })
    assert.equal(replace.status, 200)
    assert.ok(replace.body.data.uploadUrl)
  })

  it('TC-PF-30: Daftar milik sendiri memuat jumlah slot (200 OK)', async () => {
    const res = await sendRequest<MineBody>(buildTestApp(providerA), {
      method: 'GET',
      path: '/api/providers/me/portfolio',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.total, 3)
    assert.equal(res.body.data.limit, MAX_PORTFOLIO_ITEMS)
    assert.equal(res.body.data.remainingSlots, 17)
    assert.deepEqual(
      res.body.data.items.map((i) => i.id),
      [ITEM_A3_ID, ITEM_A2_ID, ITEM_A1_ID]
    )
  })
})
