import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InvestmentHolding } from '../types/database'

export function useInvestments() {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchHoldings() {
    setLoading(true)
    const { data } = await supabase
      .from('investment_holdings')
      .select('*')
      .order('current_value', { ascending: false })
    setHoldings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchHoldings()
  }, [])

  return { holdings, loading, refetch: fetchHoldings }
}
