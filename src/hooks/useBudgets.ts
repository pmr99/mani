import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Budget } from '../types/database'

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchBudgets() {
    setLoading(true)
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .order('category')
    setBudgets(data || [])
    setLoading(false)
  }

  async function addBudget(category: string, monthlyLimit: number) {
    await supabase.from('budgets').upsert(
      { category, monthly_limit: monthlyLimit },
      { onConflict: 'category' }
    )
    await fetchBudgets()
  }

  async function deleteBudget(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    await fetchBudgets()
  }

  useEffect(() => {
    fetchBudgets()
  }, [])

  return { budgets, loading, addBudget, deleteBudget, refetch: fetchBudgets }
}
