import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface StaleItem {
  id: string
  institution_name: string
  error_code: string
  error_message: string | null
}

// Plaid items that need user reauth (ITEM_LOGIN_REQUIRED, PENDING_EXPIRATION, etc.)
export function useStaleItems() {
  const [items, setItems] = useState<StaleItem[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchStale() {
    setLoading(true)
    const { data } = await supabase
      .from('plaid_items')
      .select('id, institution_name, error_code, error_message')
      .not('error_code', 'is', null)
    setItems((data || []) as StaleItem[])
    setLoading(false)
  }

  useEffect(() => { fetchStale() }, [])

  return { items, loading, refetch: fetchStale }
}
