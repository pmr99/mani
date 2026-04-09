import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = supabaseUrl.startsWith('http')

export const supabase: SupabaseClient<Database> = isConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as SupabaseClient<Database>, {
      get(_, prop) {
        if (prop === 'from') return () => ({
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: null }),
          update: () => Promise.resolve({ data: null, error: null }),
          upsert: () => Promise.resolve({ data: null, error: null }),
          delete: () => Promise.resolve({ data: null, error: null }),
        })
        if (prop === 'functions') return {
          invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        }
        return () => {}
      },
    })

export { isConfigured }
