import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type StaleKind = 'plaid_error' | 'csv_outdated'

export interface StaleItem {
  id: string
  institution_name: string
  kind: StaleKind
  error_code?: string | null
  error_message?: string | null
  last_synced_at?: string | null   // for CSV: when it was last imported/created
  age_days?: number                 // days since last update (CSV only)
}

const CSV_STALE_DAYS = 14

// Aggregates items needing action:
//   - Plaid items with an error_code (ITEM_LOGIN_REQUIRED etc.)
//   - CSV-imported items older than CSV_STALE_DAYS (user should re-upload)
export function useStaleItems() {
  const [items, setItems] = useState<StaleItem[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchStale() {
    setLoading(true)
    const { data } = await supabase
      .from('plaid_items')
      .select('id, institution_name, error_code, error_message, access_token, last_synced_at, created_at')

    const now = Date.now()
    const stale: StaleItem[] = []

    for (const row of data || []) {
      // Plaid errored items
      if (row.error_code) {
        stale.push({
          id: row.id,
          institution_name: row.institution_name,
          kind: 'plaid_error',
          error_code: row.error_code,
          error_message: row.error_message,
        })
        continue
      }
      // CSV items — flag if older than threshold
      if (row.access_token === 'csv-import') {
        const referenceTs = row.last_synced_at || row.created_at
        if (!referenceTs) continue
        const ageMs = now - new Date(referenceTs).getTime()
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
        if (ageDays >= CSV_STALE_DAYS) {
          stale.push({
            id: row.id,
            institution_name: row.institution_name,
            kind: 'csv_outdated',
            last_synced_at: referenceTs,
            age_days: ageDays,
          })
        }
      }
    }

    setItems(stale)
    setLoading(false)
  }

  useEffect(() => { fetchStale() }, [])

  return { items, loading, refetch: fetchStale }
}
