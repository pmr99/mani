import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NetWorthSnapshot } from '../types/database'

export function useNetWorth(days: number = 90) {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchSnapshots() {
    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    const { data } = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .gte('snapshot_date', startStr)
      .order('snapshot_date', { ascending: true })

    setSnapshots(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSnapshots()
  }, [days])

  return { snapshots, loading, refetch: fetchSnapshots }
}
