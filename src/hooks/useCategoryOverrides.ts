import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface CategoryOverride {
  id: string
  merchant_pattern: string
  original_category: string | null
  new_category: string
  created_at: string
}

export function useCategoryOverrides() {
  const [overrides, setOverrides] = useState<CategoryOverride[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchOverrides() {
    const { data } = await supabase
      .from('category_overrides')
      .select('*')
      .order('created_at', { ascending: false })
    setOverrides(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchOverrides() }, [])

  // Recategorize a transaction and create a rule for future matches
  const recategorize = useCallback(async (
    transactionId: string,
    merchantName: string,
    originalCategory: string | null,
    newCategory: string,
    applyToAll: boolean // apply to all transactions with same merchant
  ) => {
    // Normalize merchant name for matching
    const pattern = merchantName.toLowerCase().replace(/[#*\d]+$/g, '').replace(/\s+/g, ' ').trim()

    // 1. Update this specific transaction
    await supabase
      .from('transactions')
      .update({ category: newCategory })
      .eq('id', transactionId)

    // 2. If apply to all, update all matching transactions and save the rule
    if (applyToAll) {
      // Save the override rule
      await supabase
        .from('category_overrides')
        .upsert({
          merchant_pattern: pattern,
          original_category: originalCategory,
          new_category: newCategory,
        }, { onConflict: 'merchant_pattern' })

      // Update all existing transactions with this merchant
      // Supabase doesn't support ilike in updates easily, so fetch + batch update
      const { data: matchingTxns } = await supabase
        .from('transactions')
        .select('id, merchant_name, name')

      if (matchingTxns) {
        const toUpdate = matchingTxns.filter((t) => {
          const n = (t.merchant_name || t.name || '').toLowerCase().replace(/[#*\d]+$/g, '').replace(/\s+/g, ' ').trim()
          return n === pattern
        })
        for (const t of toUpdate) {
          await supabase
            .from('transactions')
            .update({ category: newCategory })
            .eq('id', t.id)
        }
      }

      await fetchOverrides()
    }
  }, [])

  // Get the effective category for a transaction (check overrides first)
  const getEffectiveCategory = useCallback((merchantName: string, originalCategory: string | null): string | null => {
    const pattern = merchantName.toLowerCase().replace(/[#*\d]+$/g, '').replace(/\s+/g, ' ').trim()
    const override = overrides.find((o) => o.merchant_pattern === pattern)
    return override ? override.new_category : originalCategory
  }, [overrides])

  // Delete an override rule
  const deleteOverride = useCallback(async (id: string) => {
    await supabase.from('category_overrides').delete().eq('id', id)
    await fetchOverrides()
  }, [])

  return { overrides, loading, recategorize, getEffectiveCategory, deleteOverride, refetch: fetchOverrides }
}
