import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/health.routes'
<<<<<<< Updated upstream
=======
import authRoutes from './routes/auth.routes'
import providerRoutes from './routes/provider.routes'
import categoryRoutes from './routes/category.routes'
import serviceRoutes from './routes/service.routes'
import providerProfileRoutes from './routes/provider-profile.routes'
import { AppError } from './lib/errors'
import { sendError } from './lib/http'
>>>>>>> Stashed changes

const app = express()

app.use(express.json())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
)

app.use('/api', healthRoutes)
<<<<<<< Updated upstream
=======
app.use('/api', authRoutes)
app.use('/api', providerRoutes)
app.use('/api', categoryRoutes)
app.use('/api', serviceRoutes)
app.use('/api', providerProfileRoutes)
>>>>>>> Stashed changes

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

export default app
