import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Goal } from '../types/database'

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
    setGoals(data || [])
    setLoading(false)
  }

  async function addGoal(goal: {
    name: string
    type: string
    target_amount: number
    deadline?: string | null
    monthly_contribution?: number
  }) {
    await supabase.from('goals').insert({
      name: goal.name,
      type: goal.type,
      target_amount: goal.target_amount,
      current_amount: 0,
      deadline: goal.deadline || null,
      monthly_contribution: goal.monthly_contribution || 0,
      is_active: true,
    })
    await fetchGoals()
  }

  async function updateGoal(id: string, updates: Partial<Goal>) {
    await supabase
      .from('goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    await fetchGoals()
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').update({ is_active: false }).eq('id', id)
    await fetchGoals()
  }

  useEffect(() => {
    fetchGoals()
  }, [])

  const totalMonthlyContributions = goals.reduce((s, g) => s + g.monthly_contribution, 0)

  return { goals, loading, addGoal, updateGoal, deleteGoal, totalMonthlyContributions, refetch: fetchGoals }
}
