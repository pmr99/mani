import type { Transaction } from '../../types/database'
import type { RecurringExpenseDetection } from '../../types/engines'
import { normalizeMerchantName, daysBetween, median, stdDev, mean, addDays, todayStr } from './utils'

interface TransactionGroup {
  merchantName: string
  normalizedName: string
  transactions: Transaction[]
}

function classifyFrequency(medianInterval: number): { frequency: 'weekly' | 'monthly' | 'yearly'; label: string } | null {
  if (medianInterval >= 5 && medianInterval <= 9) return { frequency: 'weekly', label: 'weekly' }
  if (medianInterval >= 25 && medianInterval <= 35) return { frequency: 'monthly', label: 'monthly' }
  if (medianInterval >= 350 && medianInterval <= 380) return { frequency: 'yearly', label: 'yearly' }
  // Bi-weekly
  if (medianInterval >= 12 && medianInterval <= 16) return { frequency: 'weekly', label: 'weekly' }
  // Quarterly
  if (medianInterval >= 85 && medianInterval <= 100) return { frequency: 'monthly', label: 'monthly' }
  return null
}

export function detectRecurringExpenses(transactions: Transaction[]): RecurringExpenseDetection[] {
  // Only look at expenses (positive amounts in Plaid convention)
  const expenses = transactions.filter((t) => t.amount > 0 && !t.pending)

  // Group by normalized merchant name
  const groups = new Map<string, TransactionGroup>()
  for (const t of expenses) {
    const raw = t.merchant_name || t.name
    const normalized = normalizeMerchantName(raw)
    if (!normalized) continue

    if (!groups.has(normalized)) {
      groups.set(normalized, { merchantName: raw, normalizedName: normalized, transactions: [] })
    }
    groups.get(normalized)!.transactions.push(t)
  }

  const results: RecurringExpenseDetection[] = []

  for (const group of groups.values()) {
    // Need at least 3 occurrences to detect a pattern
    if (group.transactions.length < 3) continue

    // Sort by date ascending
    const sorted = [...group.transactions].sort((a, b) => a.date.localeCompare(b.date))

    // Compute intervals between consecutive transactions
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }

    const medianInterval = median(intervals)
    const freq = classifyFrequency(medianInterval)
    if (!freq) continue

    // Confidence scoring
    const intervalStdDev = stdDev(intervals)
    const intervalConsistency = medianInterval > 0 ? 1 - Math.min(intervalStdDev / medianInterval, 1) : 0

    const amounts = sorted.map((t) => t.amount)
    const amountMean = mean(amounts)
    const amountStdDev = stdDev(amounts)
    const amountConsistency = amountMean > 0 ? 1 - Math.min(amountStdDev / amountMean, 1) : 0

    const lastSeen = sorted[sorted.length - 1].date
    const daysSinceLastSeen = daysBetween(lastSeen, todayStr())
    const recencyScore = Math.max(0, 1 - daysSinceLastSeen / (medianInterval * 2))

    const confidenceScore = Math.round(
      (intervalConsistency * 0.4 + amountConsistency * 0.3 + recencyScore * 0.3) * 100
    ) / 100

    if (confidenceScore < 0.5) continue

    // Subscription heuristic
    const isSubscription = amountConsistency > 0.95 &&
      (freq.frequency === 'monthly' || freq.frequency === 'yearly') &&
      amountMean < 100

    const nextExpectedDate = addDays(lastSeen, Math.round(medianInterval))

    results.push({
      merchantName: group.merchantName,
      normalizedName: group.normalizedName,
      amount: Math.round(amountMean * 100) / 100,
      amountVariance: Math.round(amountStdDev * 100) / 100,
      frequency: freq.frequency,
      intervalDays: Math.round(medianInterval),
      nextExpectedDate,
      lastSeenDate: lastSeen,
      confidenceScore,
      isSubscription,
      category: sorted[sorted.length - 1].category,
      accountId: sorted[sorted.length - 1].account_id,
    })
  }

  return results.sort((a, b) => b.confidenceScore - a.confidenceScore)
}
