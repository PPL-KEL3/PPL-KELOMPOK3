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
import { createProviderProfileRouter } from '../routes/provider-profile.routes'
import {
  setServiceListingStoreForTesting,
  type CreateServiceListingInput,
  type ServiceListingRow,
  type ServiceListingStore,
  type UpdateServiceListingInput,
} from '../services/service-listing.service'
import {
  setProviderProfileStoreForTesting,
  type OperatingHours,
  type ProviderProfileRow,
  type ProviderProfileStore,
  type ProviderProfileUpdateInput,
  type ProviderProfileWriteInput,
} from '../services/provider-profile.service'

const PROVIDER_A_ID = '11111111-1111-4111-8111-111111111111'
const PROVIDER_B_ID = '22222222-2222-4222-8222-222222222222'
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_AC_ID = '550e8400-e29b-41d4-a716-446655440001'
const CATEGORY_RUMAH_ID = '550e8400-e29b-41d4-a716-446655440002'
const UNKNOWN_CATEGORY_ID = '88888888-8888-4888-8888-888888888888'
const UNKNOWN_PROVIDER_ID = '99999999-9999-4999-8999-999999999999'
const SERVICE_A_ACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const SERVICE_A_INACTIVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const SERVICE_B_ACTIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'

type TestRole = 'admin' | 'customer' | 'provider'

interface TestIdentity {
  id: string
  role: TestRole
  verification?: 'verified' | 'pending' | 'rejected' | null
}

interface ApiErrorBody {
  success: false
  error: { code: string; message: string; fields?: Record<string, string> }
}

interface ProviderProfileBody {
  id: string
  businessName: string
  bio: string | null
  whatsappNumber: string
  address: string
  serviceArea: string
  operatingHours: OperatingHours
  primaryCategory: { id: string; name: string }
  isPublic: boolean
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
          identity.role === 'provider'
            ? identity.verification ?? 'verified'
            : null,
        providerRejectionReason: null,
      },
    }
    next()
  }

  app.use('/api', createProviderProfileRouter(mockAuthMiddleware))

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
    const req = new http.IncomingMessage(
      socket as unknown as import('node:net').Socket
    )
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

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { isOpen: true, open: '08:00', close: '17:00' },
  tuesday: { isOpen: true, open: '08:00', close: '17:00' },
  wednesday: { isOpen: true, open: '08:00', close: '17:00' },
  thursday: { isOpen: true, open: '08:00', close: '17:00' },
  friday: { isOpen: true, open: '08:00', close: '17:00' },
  saturday: { isOpen: true, open: '08:00', close: '12:00' },
  sunday: { isOpen: false },
}

function validProfilePayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    businessName: 'Bengkel Pak Budi',
    bio: 'Melayani servis AC, kulkas, dan mesin cuci di sekitar Bandung.',
    whatsappNumber: '0812-3456-7890',
    address: 'Jl. Cihampelas No. 10, Bandung',
    serviceArea: 'Kecamatan Coblong dan sekitarnya',
    operatingHours: DEFAULT_OPERATING_HOURS,
    primaryCategoryId: CATEGORY_AC_ID,
    isPublic: false,
    ...overrides,
  }
}

function createInMemoryProviderProfileStore(): {
  store: ProviderProfileStore
  rows: ProviderProfileRow[]
} {
  const rows: ProviderProfileRow[] = []

  const withCategoryName = (row: ProviderProfileRow): ProviderProfileRow => ({
    ...row,
    categories: {
      name: CATEGORY_NAMES[row.primary_category_id] ?? 'Kategori Jasa',
    },
  })

  const store: ProviderProfileStore = {
    async categoryExists(categoryId: string) {
      return { exists: Boolean(CATEGORY_NAMES[categoryId]), error: null }
    },

    async findById(profileId: string) {
      const found = rows.find((row) => row.profile_id === profileId)
      return {
        data: found ? withCategoryName(found) : null,
        error: null,
      }
    },

    async findPublicById(profileId: string) {
      const found = rows.find(
        (row) => row.profile_id === profileId && row.is_public
      )
      return {
        data: found ? withCategoryName(found) : null,
        error: null,
      }
    },

    async upsert(profileId: string, input: ProviderProfileWriteInput) {
      const index = rows.findIndex((row) => row.profile_id === profileId)
      const now = '2026-11-12T10:00:00.000Z'
      const row: ProviderProfileRow = {
        profile_id: profileId,
        business_name: input.businessName,
        bio: input.bio,
        whatsapp_number: input.whatsappNumber,
        address: input.address,
        service_area: input.serviceArea,
        service_areas: index >= 0 ? rows[index].service_areas ?? [] : [],
        operating_hours: input.operatingHours,
        primary_category_id: input.primaryCategoryId,
        is_public: input.isPublic,
        created_at: index >= 0 ? rows[index].created_at : now,
        updated_at: now,
      }

      if (index >= 0) {
        rows[index] = row
      } else {
        rows.push(row)
      }

      return { data: withCategoryName(row), error: null }
    },

    async updateById(
      profileId: string,
      input: ProviderProfileUpdateInput
    ) {
      const index = rows.findIndex((row) => row.profile_id === profileId)
      if (index === -1) return { data: null, error: null }

      const current = rows[index]
      const updated: ProviderProfileRow = {
        ...current,
        business_name: input.businessName ?? current.business_name,
        bio: input.bio !== undefined ? input.bio : current.bio,
        whatsapp_number: input.whatsappNumber ?? current.whatsapp_number,
        address: input.address ?? current.address,
        service_area: input.serviceArea ?? current.service_area,
        service_areas: input.serviceAreas ?? current.service_areas ?? [],
        operating_hours: input.operatingHours ?? current.operating_hours,
        primary_category_id:
          input.primaryCategoryId ?? current.primary_category_id,
        is_public: input.isPublic ?? current.is_public,
        updated_at: '2026-11-12T11:00:00.000Z',
      }

      rows[index] = updated
      return { data: withCategoryName(updated), error: null }
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
        .filter((row) =>
          filter?.providerId ? row.provider_id === filter.providerId : true
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
      const now = '2026-11-12T12:00:00.000Z'
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
        updated_at: '2026-11-12T13:00:00.000Z',
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

const providerA: TestIdentity = {
  id: PROVIDER_A_ID,
  role: 'provider',
  verification: 'verified',
}
const providerB: TestIdentity = {
  id: PROVIDER_B_ID,
  role: 'provider',
  verification: 'pending',
}

describe('TPR-9 / TPR-60: Pengelolaan Profil Penyedia dan Kontak WhatsApp (TC-PRF-01 s.d. TC-PRF-15)', () => {
  let profileMemory: ReturnType<typeof createInMemoryProviderProfileStore>
  let serviceMemory: ReturnType<typeof createInMemoryServiceStore>

  beforeEach(() => {
    profileMemory = createInMemoryProviderProfileStore()
    serviceMemory = createInMemoryServiceStore(SEED_SERVICES)
    setProviderProfileStoreForTesting(profileMemory.store)
    setServiceListingStoreForTesting(serviceMemory.store)
  })

  afterEach(() => {
    setProviderProfileStoreForTesting(null)
    setServiceListingStoreForTesting(null)
  })

  it('TC-PRF-01: Provider dapat mengambil profil sendiri saat belum ada (profile null)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody | null }
    }>(buildTestApp(providerA), { method: 'GET', path: '/api/providers/me' })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.profile, null)
  })

  it('TC-PRF-02: Provider pending dapat membuat profil lengkap (PUT upsert)', async () => {
    const response = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody; message: string }
    }>(buildTestApp(providerB), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({
        businessName: '  Bengkel   Bu Sari ',
        whatsappNumber: '0812-3456-7890',
      }),
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.profile.businessName, 'Bengkel Bu Sari')
    assert.equal(response.body.data.profile.whatsappNumber, '6281234567890')
    assert.equal(response.body.data.profile.isPublic, false)
    assert.equal(
      response.body.data.profile.primaryCategory.name,
      'Servis Elektronik & AC'
    )
    assert.equal(profileMemory.rows.length, 1)
  })

  it('TC-PRF-03: Provider dapat memperbarui alamat, area, bio, dan jam operasional', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload(),
    })

    const response = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody }
    }>(buildTestApp(providerA), {
      method: 'PATCH',
      path: '/api/providers/me',
      body: {
        address: 'Jl. Dago Atas No. 22, Bandung',
        serviceArea: 'Dago, Coblong, Bandung',
        bio: 'Spesialis servis AC dan kulkas dua pintu.',
        operatingHours: {
          ...DEFAULT_OPERATING_HOURS,
          sunday: { isOpen: true, open: '09:00', close: '14:00' },
        },
      },
    })

    assert.equal(response.status, 200)
    assert.equal(
      response.body.data.profile.address,
      'Jl. Dago Atas No. 22, Bandung'
    )
    assert.equal(response.body.data.profile.serviceArea, 'Dago, Coblong, Bandung')
    assert.equal(response.body.data.profile.operatingHours.sunday.isOpen, true)
  })

  it('TC-PRF-04: Switch publik aktif menampilkan profil dan hanya layanan aktif', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ isPublic: true }),
    })

    const response = await sendRequest<{
      success: boolean
      data: {
        provider: ProviderProfileBody
        services: Array<{ id: string; isActive: boolean }>
      }
    }>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_A_ID}`,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.provider.businessName, 'Bengkel Pak Budi')
    assert.equal(response.body.data.provider.isPublic, true)
    assert.equal(response.body.data.services.length, 1)
    assert.equal(response.body.data.services[0].id, SERVICE_A_ACTIVE_ID)
    assert.equal(response.body.data.services[0].isActive, true)
    assert.ok(
      !response.body.data.services.some(
        (item) => item.id === SERVICE_A_INACTIVE_ID
      )
    )
  })

  it('TC-PRF-05: Switch publik nonaktif menyembunyikan profil (404)', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ isPublic: true }),
    })

    const patchResponse = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody }
    }>(buildTestApp(providerA), {
      method: 'PATCH',
      path: '/api/providers/me',
      body: { isPublic: false },
    })

    assert.equal(patchResponse.status, 200)
    assert.equal(patchResponse.body.data.profile.isPublic, false)

    const publicResponse = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_A_ID}`,
    })

    assert.equal(publicResponse.status, 404)
    assert.equal(publicResponse.body.error.code, 'PROVIDER_PROFILE_NOT_FOUND')
  })

  it('TC-PRF-06: Profil publik yang tidak ada menghasilkan 404', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${UNKNOWN_PROVIDER_ID}`,
    })

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'PROVIDER_PROFILE_NOT_FOUND')
  })

  it('TC-PRF-07: Format ID penyedia tidak valid ditolak (400)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: '/api/providers/bukan-uuid',
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'INVALID_PROVIDER_ID')
  })

  it('TC-PRF-08: Field inti wajib ditolak dengan pesan per field (400)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: {},
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    assert.equal(response.body.error.fields?.businessName, 'Nama usaha wajib diisi.')
    assert.equal(
      response.body.error.fields?.whatsappNumber,
      'Nomor WhatsApp wajib diisi.'
    )
    assert.equal(
      response.body.error.fields?.address,
      'Alamat lengkap wajib diisi.'
    )
    assert.equal(response.body.error.fields?.serviceArea, 'Area layanan wajib diisi.')
    assert.equal(
      response.body.error.fields?.primaryCategoryId,
      'Kategori utama wajib dipilih.'
    )
  })

  it('TC-PRF-09: Nomor WhatsApp dinormalisasi dari +62/08/8 ke format 62', async () => {
    const app = buildTestApp(providerA)

    const plus62 = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody }
    }>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ whatsappNumber: '+62 812 3456 7890' }),
    })
    assert.equal(plus62.status, 200)
    assert.equal(plus62.body.data.profile.whatsappNumber, '6281234567890')

    const leadingEight = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody }
    }>(app, {
      method: 'PATCH',
      path: '/api/providers/me',
      body: { whatsappNumber: '812-3456-7891' },
    })
    assert.equal(leadingEight.status, 200)
    assert.equal(leadingEight.body.data.profile.whatsappNumber, '6281234567891')
  })

  it('TC-PRF-10: Nomor WhatsApp tidak valid ditolak (400)', async () => {
    const app = buildTestApp(providerA)

    const letters = await sendRequest<ApiErrorBody>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ whatsappNumber: 'bukan-nomor' }),
    })
    assert.equal(letters.status, 400)
    assert.ok(letters.body.error.fields?.whatsappNumber)

    const tooShort = await sendRequest<ApiErrorBody>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ whatsappNumber: '0812' }),
    })
    assert.equal(tooShort.status, 400)
    assert.ok(tooShort.body.error.fields?.whatsappNumber)
  })

  it('TC-PRF-11: Alamat dan area layanan terlalu pendek ditolak (400)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ address: 'Jln', serviceArea: 'A' }),
    })

    assert.equal(response.status, 400)
    assert.ok(response.body.error.fields?.address)
    assert.ok(response.body.error.fields?.serviceArea)
  })

  it('TC-PRF-12: Jam operasional wajib lengkap, valid, dan minimal satu hari buka (400)', async () => {
    const app = buildTestApp(providerA)

    const missingDay = await sendRequest<ApiErrorBody>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({
        operatingHours: {
          ...DEFAULT_OPERATING_HOURS,
          sunday: undefined,
        },
      }),
    })
    assert.equal(missingDay.status, 400)
    assert.ok(missingDay.body.error.fields?.operatingHours)

    const invalidRange = await sendRequest<ApiErrorBody>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({
        operatingHours: {
          ...DEFAULT_OPERATING_HOURS,
          monday: { isOpen: true, open: '18:00', close: '08:00' },
        },
      }),
    })
    assert.equal(invalidRange.status, 400)
    assert.ok(invalidRange.body.error.fields?.operatingHours)

    const allClosed = await sendRequest<ApiErrorBody>(app, {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({
        operatingHours: {
          monday: { isOpen: false },
          tuesday: { isOpen: false },
          wednesday: { isOpen: false },
          thursday: { isOpen: false },
          friday: { isOpen: false },
          saturday: { isOpen: false },
          sunday: { isOpen: false },
        },
      }),
    })
    assert.equal(allClosed.status, 400)
    assert.ok(allClosed.body.error.fields?.operatingHours)
  })

  it('TC-PRF-13: Kategori utama yang tidak terdaftar ditolak (400 INVALID_CATEGORY_REFERENCE)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ primaryCategoryId: UNKNOWN_CATEGORY_ID }),
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.error.code, 'INVALID_CATEGORY_REFERENCE')
    assert.ok(response.body.error.fields?.primaryCategoryId)
  })

  it('TC-PRF-14: Anon, customer, dan provider lain tidak dapat mengubah profil', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload(),
    })

    const guest = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: '/api/providers/me',
    })
    assert.equal(guest.status, 401)
    assert.equal(guest.body.error.code, 'NO_SESSION')

    const customer = await sendRequest<ApiErrorBody>(
      buildTestApp({ id: CUSTOMER_ID, role: 'customer' }),
      { method: 'PUT', path: '/api/providers/me', body: validProfilePayload() }
    )
    assert.equal(customer.status, 403)
    assert.equal(customer.body.error.code, 'FORBIDDEN')

    const providerBResponse = await sendRequest<{
      success: boolean
      data: { profile: ProviderProfileBody | null }
    }>(buildTestApp(providerB), { method: 'GET', path: '/api/providers/me' })
    assert.equal(providerBResponse.status, 200)
    assert.equal(providerBResponse.body.data.profile, null)
  })

  it('TC-PRF-15: Respons publik tidak memuat data privat dan hanya layanan aktif', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ isPublic: true }),
    })

    const response = await sendRequest<{
      success: boolean
      data: {
        provider: Record<string, unknown>
        services: Array<{ id: string; isActive: boolean }>
      }
    }>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_A_ID}`,
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.provider.email, undefined)
    assert.equal(response.body.data.provider.fullName, undefined)
    assert.ok(
      response.body.data.services.every((service) => service.isActive)
    )
    assert.ok(
      response.body.data.services.some(
        (service) => service.id === SERVICE_A_ACTIVE_ID
      )
    )
    assert.ok(
      !response.body.data.services.some(
        (service) => service.id === SERVICE_B_ACTIVE_ID
      )
    )
  })

  async function createProviderProfile(identity: TestIdentity) {
    return sendRequest(buildTestApp(identity), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload(),
    })
  }

  it('TC-AREA-01: Provider belum punya profil tidak bisa mengakses wilayah layanan (404)', async () => {
    const response = await sendRequest<ApiErrorBody>(buildTestApp(providerA), {
      method: 'GET',
      path: '/api/providers/me/service-areas',
    })

    assert.equal(response.status, 404)
    assert.equal(response.body.error.code, 'PROVIDER_PROFILE_NOT_FOUND')
  })

  it('TC-AREA-02: Daftar wilayah kosong setelah profil dibuat (200)', async () => {
    await createProviderProfile(providerA)

    const response = await sendRequest<{
      success: boolean
      data: { serviceAreas: unknown[] }
    }>(buildTestApp(providerA), {
      method: 'GET',
      path: '/api/providers/me/service-areas',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.serviceAreas, [])
  })

  it('TC-AREA-03: Provider dapat menambahkan wilayah + radius valid (201)', async () => {
    await createProviderProfile(providerA)

    const response = await sendRequest<{
      success: boolean
      data: {
        serviceArea: { id: string; areaName: string; radiusKm: number }
        serviceAreas: Array<{ id: string; areaName: string; radiusKm: number }>
        message: string
      }
    }>(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: '  Kecamatan   Coblong ', radiusKm: 5 },
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.data.serviceArea.areaName, 'Kecamatan Coblong')
    assert.equal(response.body.data.serviceArea.radiusKm, 5)
    assert.equal(response.body.data.serviceAreas.length, 1)
    assert.ok(response.body.data.serviceArea.id)
  })

  it('TC-AREA-04: Menolak nama wilayah/radius tidak valid (400)', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)

    const emptyName = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: '  ', radiusKm: 5 },
    })
    assert.equal(emptyName.status, 400)
    assert.ok(emptyName.body.error.fields?.areaName)

    const invalidRadius = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Dago', radiusKm: 0 },
    })
    assert.equal(invalidRadius.status, 400)
    assert.ok(invalidRadius.body.error.fields?.radiusKm)

    const tooFar = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Dago', radiusKm: 101 },
    })
    assert.equal(tooFar.status, 400)
    assert.ok(tooFar.body.error.fields?.radiusKm)
  })

  it('TC-AREA-05: Menolak nama wilayah duplikat (case-insensitive)', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)

    await sendRequest(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
    })

    const duplicate = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: '  kecamatan   coblong ', radiusKm: 8 },
    })

    assert.equal(duplicate.status, 400)
    assert.equal(duplicate.body.error.fields?.areaName, 'Nama wilayah layanan sudah digunakan.')
  })

  it('TC-AREA-06: Maksimal 10 wilayah layanan per provider', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)

    for (let index = 1; index <= 10; index += 1) {
      const res = await sendRequest(app, {
        method: 'POST',
        path: '/api/providers/me/service-areas',
        body: { areaName: `Wilayah ${index}`, radiusKm: 5 },
      })
      assert.equal(res.status, 201)
    }

    const overflow = await sendRequest<ApiErrorBody>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Wilayah 11', radiusKm: 5 },
    })

    assert.equal(overflow.status, 400)
    assert.ok(overflow.body.error.fields?.areaName)
  })

  it('TC-AREA-07: Provider dapat memperbarui wilayah/radius miliknya (200)', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)

    const created = await sendRequest<{
      success: boolean
      data: { serviceArea: { id: string } }
    }>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
    })

    const areaId = created.body.data.serviceArea.id
    const response = await sendRequest<{
      success: boolean
      data: {
        serviceArea: { id: string; areaName: string; radiusKm: number }
      }
    }>(app, {
      method: 'PATCH',
      path: `/api/providers/me/service-areas/${areaId}`,
      body: { areaName: 'Kecamatan Coblong Baru', radiusKm: 12 },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.serviceArea.areaName, 'Kecamatan Coblong Baru')
    assert.equal(response.body.data.serviceArea.radiusKm, 12)
  })

  it('TC-AREA-08: Update/hapus wilayah tidak dikenal menghasilkan 404 dan ID invalid 400', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)
    const unknownId = '99999999-9999-4999-8999-999999999999'

    const updateRes = await sendRequest<ApiErrorBody>(app, {
      method: 'PATCH',
      path: `/api/providers/me/service-areas/${unknownId}`,
      body: { radiusKm: 10 },
    })
    assert.equal(updateRes.status, 404)
    assert.equal(updateRes.body.error.code, 'SERVICE_AREA_NOT_FOUND')

    const deleteRes = await sendRequest<ApiErrorBody>(app, {
      method: 'DELETE',
      path: `/api/providers/me/service-areas/${unknownId}`,
    })
    assert.equal(deleteRes.status, 404)
    assert.equal(deleteRes.body.error.code, 'SERVICE_AREA_NOT_FOUND')

    const invalidId = await sendRequest<ApiErrorBody>(app, {
      method: 'DELETE',
      path: '/api/providers/me/service-areas/bukan-uuid',
    })
    assert.equal(invalidId.status, 400)
    assert.equal(invalidId.body.error.code, 'INVALID_SERVICE_AREA_ID')
  })

  it('TC-AREA-09: Provider dapat menghapus wilayah miliknya (200)', async () => {
    await createProviderProfile(providerA)
    const app = buildTestApp(providerA)

    const created = await sendRequest<{
      success: boolean
      data: { serviceArea: { id: string } }
    }>(app, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
    })

    const areaId = created.body.data.serviceArea.id
    const deleted = await sendRequest<{
      success: boolean
      data: { serviceArea: { id: string }; serviceAreas: unknown[] }
    }>(app, {
      method: 'DELETE',
      path: `/api/providers/me/service-areas/${areaId}`,
    })

    assert.equal(deleted.status, 200)
    assert.equal(deleted.body.data.serviceArea.id, areaId)
    assert.deepEqual(deleted.body.data.serviceAreas, [])
  })

  it('TC-AREA-10: Wilayah layanan tampil di profil publik', async () => {
    await sendRequest(buildTestApp(providerA), {
      method: 'PUT',
      path: '/api/providers/me',
      body: validProfilePayload({ isPublic: true }),
    })

    await sendRequest(buildTestApp(providerA), {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
    })

    const publicResponse = await sendRequest<{
      success: boolean
      data: {
        provider: {
          serviceAreas: Array<{ areaName: string; radiusKm: number }>
        }
      }
    }>(buildTestApp(null), {
      method: 'GET',
      path: `/api/providers/${PROVIDER_A_ID}`,
    })

    assert.equal(publicResponse.status, 200)
    assert.equal(publicResponse.body.data.provider.serviceAreas.length, 1)
    assert.equal(
      publicResponse.body.data.provider.serviceAreas[0].areaName,
      'Kecamatan Coblong'
    )
    assert.equal(publicResponse.body.data.provider.serviceAreas[0].radiusKm, 5)
  })

  it('TC-AREA-11: Provider lain tidak melihat/mengubah wilayah provider A', async () => {
    await createProviderProfile(providerA)
    const appA = buildTestApp(providerA)
    const created = await sendRequest<{
      success: boolean
      data: { serviceArea: { id: string } }
    }>(appA, {
      method: 'POST',
      path: '/api/providers/me/service-areas',
      body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
    })
    const areaId = created.body.data.serviceArea.id

    await createProviderProfile(providerB)
    const appB = buildTestApp(providerB)

    const listB = await sendRequest<{
      success: boolean
      data: { serviceAreas: unknown[] }
    }>(appB, { method: 'GET', path: '/api/providers/me/service-areas' })
    assert.deepEqual(listB.body.data.serviceAreas, [])

    const updateB = await sendRequest<ApiErrorBody>(appB, {
      method: 'PATCH',
      path: `/api/providers/me/service-areas/${areaId}`,
      body: { radiusKm: 20 },
    })
    assert.equal(updateB.status, 404)
    assert.equal(updateB.body.error.code, 'SERVICE_AREA_NOT_FOUND')
  })

  it('TC-AREA-12: Anon dan customer tidak dapat mengelola wilayah layanan', async () => {
    const guest = await sendRequest<ApiErrorBody>(buildTestApp(null), {
      method: 'GET',
      path: '/api/providers/me/service-areas',
    })
    assert.equal(guest.status, 401)
    assert.equal(guest.body.error.code, 'NO_SESSION')

    const customer = await sendRequest<ApiErrorBody>(
      buildTestApp({ id: CUSTOMER_ID, role: 'customer' }),
      {
        method: 'POST',
        path: '/api/providers/me/service-areas',
        body: { areaName: 'Kecamatan Coblong', radiusKm: 5 },
      }
    )
    assert.equal(customer.status, 403)
    assert.equal(customer.body.error.code, 'FORBIDDEN')
  })
})
