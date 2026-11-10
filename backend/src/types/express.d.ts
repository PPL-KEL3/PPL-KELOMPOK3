import type { AuthProfile } from '../services/profile.service'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        profile: AuthProfile
        accessToken: string
        remember: boolean
      }
    }
  }
}

export {}
