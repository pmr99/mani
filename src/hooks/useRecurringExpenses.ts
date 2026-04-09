import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useTransactions } from './useTransactions'
import { detectRecurringExpenses } from '../lib/engines/recurring-detection'
import type { RecurringExpenseResult } from '../types/engines'

export function useRecurringExpenses() {
  const [expenses, setExpenses] = useState<RecurringExpenseResult[]>([])
  const [loading, setLoading] = useState(true)
  const { transactions } = useTransactions({ months: 4 })

  async function fetchExpenses() {
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_dismissed', false)
      .order('next_expected_date')

    if (data && data.length > 0) {
      setExpenses(data.map((e) => ({
        id: e.id,
        merchantName: e.merchant_name,
        normalizedName: e.normalized_name,
        amount: e.amount,
        frequency: e.frequency as 'weekly' | 'monthly' | 'yearly',
        intervalDays: e.interval_days,
        nextExpectedDate: e.next_expected_date,
        lastSeenDate: e.last_seen_date,
        confidenceScore: e.confidence_score,
        isSubscription: e.is_subscription,
        isDismissed: e.is_dismissed,
        category: e.category,
        accountId: e.account_id,
      })))
      setLoading(false)
      return
    }

    // No persisted data — run detection if we have transactions
    if (transactions.length > 0) {
      await detectAndSave()
    }
    setLoading(false)
  }

  const detectAndSave = useCallback(async () => {
    if (transactions.length === 0) return

    setLoading(true)
    const detected = detectRecurringExpenses(transactions)

    // Clear old detections and save new ones
    await supabase.from('recurring_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    if (detected.length > 0) {
      const rows = detected.map((d) => ({
        merchant_name: d.merchantName,
        normalized_name: d.normalizedName,
        amount: d.amount,
        amount_variance: d.amountVariance,
        frequency: d.frequency,
        interval_days: d.intervalDays,
        next_expected_date: d.nextExpectedDate,
        last_seen_date: d.lastSeenDate,
        confidence_score: d.confidenceScore,
        is_subscription: d.isSubscription,
        is_dismissed: false,
        category: d.category,
        account_id: d.accountId,
      }))
      await supabase.from('recurring_expenses').insert(rows)
    }

    await fetchExpenses()
  }, [transactions])

  useEffect(() => {
    fetchExpenses()
  }, [transactions.length])

  const subscriptions = expenses.filter((e) => e.isSubscription)
  const totalMonthly = expenses.reduce((sum, e) => {
    if (e.frequency === 'monthly') return sum + e.amount
    if (e.frequency === 'weekly') return sum + e.amount * 4.33
    if (e.frequency === 'yearly') return sum + e.amount / 12
    return sum
  }, 0)

  return { expenses, subscriptions, totalMonthly, loading, detectAndSave }
}
