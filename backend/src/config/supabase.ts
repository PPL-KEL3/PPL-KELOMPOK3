import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function getSupabaseEnv(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  return {
    url: supabaseUrl.replace(/\/$/, ''),
    anonKey: supabaseAnonKey,
  }
}

/**
 * Creates a Supabase client per request.
 *
 * Supabase clients keep mutable auth state, so a shared singleton is not safe
 * for server-side authentication. `accessToken` is used to run RLS-protected
 * queries as the signed-in user.
 */
export function createSupabaseClient(accessToken?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv()

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  })
}

// Backward-compatible singleton used by the health endpoint.
export const supabase = supabaseConfigured ? createSupabaseClient() : null
