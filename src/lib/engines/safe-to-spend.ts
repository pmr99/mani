import type { SafeToSpendInput, SafeToSpendResult, RecurringExpenseResult } from '../../types/engines'
import { daysRemainingInMonth, dayOfMonth, todayStr, daysBetween, formatCurrency } from './utils'

function upcomingRecurringTotal(expenses: RecurringExpenseResult[], daysAhead: number): number {
  const today = todayStr()
  let total = 0
  for (const exp of expenses) {
    if (exp.isDismissed) continue
    const daysUntil = daysBetween(today, exp.nextExpectedDate)
    // Only count if the next date is in the future and within our window
    if (exp.nextExpectedDate >= today && daysUntil <= daysAhead) {
      total += exp.amount
    }
  }
  return total
}

export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const { accounts, recurringExpenses, currentMonthTransactions, goalContributions } = input

  // Available cash from depository accounts
  const availableCash = accounts
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.available_balance ?? a.current_balance ?? 0), 0)

  // Already spent this month (positive amounts = expenses in Plaid)
  const alreadySpentThisMonth = currentMonthTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const remaining = daysRemainingInMonth()
  const dayNum = dayOfMonth()

  // Upcoming recurring expenses for rest of month
  const upcomingRecurring = upcomingRecurringTotal(recurringExpenses, remaining)

  // Goal reserves prorated for remaining month
  const goalReserves = remaining > 0 ? goalContributions * (remaining / (dayNum + remaining)) : 0

  // 10% safety buffer
  const subtotal = availableCash - upcomingRecurring - goalReserves
  const buffer = Math.max(subtotal * 0.1, 0)

  const safeToSpendThisMonth = Math.max(0, subtotal - buffer)
  const safeToSpendThisWeek = remaining > 0
    ? Math.max(0, safeToSpendThisMonth * Math.min(7 / remaining, 1))
    : safeToSpendThisMonth
  const safeToSpendToday = Math.max(0, safeToSpendThisWeek / 7)

  // Confidence based on data quality
  const activeRecurring = recurringExpenses.filter((e) => !e.isDismissed)
  const avgConfidence = activeRecurring.length > 0
    ? activeRecurring.reduce((s, e) => s + e.confidenceScore, 0) / activeRecurring.length
    : 0
  const hasEnoughData = currentMonthTransactions.length > 5

  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (hasEnoughData && avgConfidence > 0.7) confidence = 'high'
  else if (hasEnoughData || avgConfidence > 0.5) confidence = 'medium'

  // Explanation
  let explanation: string
  if (safeToSpendToday > 50) {
    explanation = `You're in good shape. You can comfortably spend ${formatCurrency(safeToSpendToday)} today.`
  } else if (safeToSpendToday > 0) {
    explanation = `Budget is tight. Try to keep today's spending under ${formatCurrency(safeToSpendToday)}.`
  } else {
    explanation = 'You\'ve likely reached your spending limit for now. Consider holding off on non-essentials.'
  }

  return {
    safeToSpendToday: Math.round(safeToSpendToday * 100) / 100,
    safeToSpendThisWeek: Math.round(safeToSpendThisWeek * 100) / 100,
    safeToSpendThisMonth: Math.round(safeToSpendThisMonth * 100) / 100,
    confidence,
    breakdown: {
      availableCash: Math.round(availableCash * 100) / 100,
      alreadySpentThisMonth: Math.round(alreadySpentThisMonth * 100) / 100,
      upcomingRecurring: Math.round(upcomingRecurring * 100) / 100,
      goalReserves: Math.round(goalReserves * 100) / 100,
      buffer: Math.round(buffer * 100) / 100,
    },
    explanation,
  }
}
