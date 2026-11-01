import { Router, Request, Response } from 'express'
import { supabaseConfigured } from '../config/supabase'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'loka-api',
    supabaseConfigured,
  })
})

export default router
