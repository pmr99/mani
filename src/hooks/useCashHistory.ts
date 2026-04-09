import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface CashDailyValue {
  id: string
  account_id: string
  date: string
  value: number
}

interface CashHistoryOptions {
  days?: number
  accountId?: string
}

export function useCashHistory(options?: CashHistoryOptions) {
  const [values, setValues] = useState<CashDailyValue[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const days = options?.days || 90

  async function fetchValues() {
    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    let query = supabase
      .from('cash_daily_values')
      .select('*')
      .gte('date', startStr)
      .order('date', { ascending: true })

    if (options?.accountId) {
      query = query.eq('account_id', options.accountId)
    }

    const { data } = await query
    setValues(data || [])
    setLoading(false)
  }

  const syncHistory = useCallback(async () => {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-cash-history')
      if (error) throw error
      await fetchValues()
      return data
    } catch (err) {
      console.error('Failed to sync cash history:', err)
      return null
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchValues()
  }, [days, options?.accountId])

  // Auto-sync on first load if no data
  useEffect(() => {
    if (!loading && values.length === 0) {
      syncHistory()
    }
  }, [loading, values.length])

  // Aggregate by date
  const aggregatedByDate = values.reduce<Record<string, number>>((acc, v) => {
    acc[v.date] = (acc[v.date] || 0) + v.value
    return acc
  }, {})

  const timeline = Object.entries(aggregatedByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))

  // Per-account timelines
  const byAccount = values.reduce<Record<string, { date: string; value: number }[]>>((acc, v) => {
    if (!acc[v.account_id]) acc[v.account_id] = []
    acc[v.account_id].push({ date: v.date, value: v.value })
    return acc
  }, {})

  return { values, timeline, byAccount, loading, syncing, syncHistory, refetch: fetchValues }
}
