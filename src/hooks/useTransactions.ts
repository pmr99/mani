import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../types/database'

interface Filters {
  search?: string
  category?: string
  startDate?: string
  endDate?: string
  accountId?: string
  months?: number // fetch last N months of data (no row limit)
  all?: boolean // fetch all data, no limit
}

export function useTransactions(filters?: Filters) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTransactions() {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    // If all is set, no limit. If months is set, compute start date. Otherwise limit 500.
    if (filters?.all) {
      // no limit, no date filter
    } else if (filters?.months) {
      const start = new Date()
      start.setMonth(start.getMonth() - filters.months)
      query = query.gte('date', start.toISOString().split('T')[0])
    } else {
      query = query.limit(500)
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,merchant_name.ilike.%${filters.search}%`)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate)
    }
    if (filters?.accountId) {
      query = query.eq('account_id', filters.accountId)
    }

    const { data } = await query
    setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTransactions()
  }, [filters?.search, filters?.category, filters?.startDate, filters?.endDate, filters?.accountId, filters?.months, filters?.all])

  return { transactions, loading, refetch: fetchTransactions }
}
