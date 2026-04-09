import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account } from '../types/database'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAccounts() {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .order('name')
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  return { accounts, loading, refetch: fetchAccounts }
}
