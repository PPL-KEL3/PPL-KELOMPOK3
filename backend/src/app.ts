import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import healthRoutes from './routes/health.routes'
import authRoutes from './routes/auth.routes'
import providerRoutes from './routes/provider.routes'
import categoryRoutes from './routes/category.routes'
import { AppError } from './lib/errors'
import { sendError } from './lib/http'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
)
app.use(express.json({ limit: '16kb' }))

app.use('/api', healthRoutes)
app.use('/api', authRoutes)
app.use('/api', providerRoutes)
app.use('/api', categoryRoutes)

app.use('/api', (_req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')
})

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return

    if (err instanceof AppError) {
      sendError(res, err.status, err.code, err.message, err.fields)
      return
    }

    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      sendError(res, 400, 'INVALID_JSON', 'Format permintaan tidak valid.')
      return
    }

    console.error(
      '[api] Unhandled error',
      err instanceof Error
        ? { name: err.name, message: err.message }
        : { name: 'unknown' }
    )
    sendError(
      res,
      500,
      'INTERNAL_ERROR',
      'Terjadi kesalahan pada server. Silakan coba lagi.'
    )
  }
)

export default app
