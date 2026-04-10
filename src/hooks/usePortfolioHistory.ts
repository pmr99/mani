import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { isFreeMode } from '../lib/freeMode'
import type { PortfolioDailyValue } from '../types/database'

interface PortfolioHistoryOptions {
  days?: number
  accountId?: string // filter to specific account
}

export function usePortfolioHistory(options?: PortfolioHistoryOptions) {
  const [values, setValues] = useState<PortfolioDailyValue[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const days = options?.days || 90

  async function fetchValues() {
    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    let query = supabase
      .from('portfolio_daily_values')
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

  // Trigger a sync of investment history
  const syncHistory = useCallback(async () => {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-investment-history')
      if (error) throw error
      // Refetch after sync
      await fetchValues()
      return data
    } catch (err) {
      console.error('Failed to sync investment history:', err)
      return null
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    // Fetch existing values first, then auto-sync if empty
    fetchValues().then(() => {
      setLoading(false)
    })
  }, [days, options?.accountId])

  // Auto-sync on first load if no data exists (skip in free mode — uses paid API)
  useEffect(() => {
    if (!loading && values.length === 0 && !isFreeMode()) {
      syncHistory()
    }
  }, [loading, values.length])

  // Aggregate by date (sum across accounts if no accountId filter)
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
