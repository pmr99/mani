import type { OverspendingRiskInput, OverspendingRiskResult } from '../../types/engines'
import { daysRemainingInMonth, dayOfMonth, currentMonthKey, mean, formatCurrency } from './utils'

function getMonthKey(date: string): string {
  return date.substring(0, 7)
}

export function computeOverspendingRisk(input: OverspendingRiskInput): OverspendingRiskResult {
  const { currentMonthTransactions, historicalTransactions, accounts } = input

  const dayNum = dayOfMonth()
  const remaining = daysRemainingInMonth()
  const monthKey = currentMonthKey()

  // Current month spending (positive amounts = expenses)
  const currentSpend = currentMonthTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  // Historical monthly totals (last 3 months, excluding current)
  const monthlyTotals = new Map<string, number>()
  for (const t of historicalTransactions) {
    if (t.amount <= 0) continue
    const mk = getMonthKey(t.date)
    if (mk === monthKey) continue
    monthlyTotals.set(mk, (monthlyTotals.get(mk) || 0) + t.amount)
  }
  const historicalMonths = Array.from(monthlyTotals.values())
  const historicalAvg = mean(historicalMonths)

  // Burn rates
  const burnRate = dayNum > 0 ? currentSpend / dayNum : 0
  const historicalBurnRate = historicalAvg / 30

  // Projected end-of-month spend
  const projectedMonthlySpend = currentSpend + burnRate * remaining

  // Available cash
  const availableCash = accounts
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.available_balance ?? a.current_balance ?? 0), 0)

  // Expected income (negative amounts in Plaid = income)
  const currentMonthIncome = currentMonthTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const historicalIncome = historicalMonths.length > 0
    ? mean(historicalTransactions
        .filter((t) => t.amount < 0 && getMonthKey(t.date) !== monthKey)
        .reduce((acc, t) => {
          const mk = getMonthKey(t.date)
          acc.set(mk, (acc.get(mk) || 0) + Math.abs(t.amount))
          return acc
        }, new Map<string, number>())
        .values()
        .toArray())
    : 0
  const expectedRemainingIncome = Math.max(0, historicalIncome - currentMonthIncome)

  const projectedDeficit = Math.max(0, projectedMonthlySpend - availableCash - expectedRemainingIncome)

  // Capacity ratio: projected spend vs (available cash + expected income)
  const capacity = availableCash + expectedRemainingIncome
  const capacityRatio = capacity > 0 ? projectedMonthlySpend / capacity : 2

  let riskLevel: 'low' | 'medium' | 'high' | 'critical'
  if (capacityRatio < 0.8) riskLevel = 'low'
  else if (capacityRatio < 0.95) riskLevel = 'medium'
  else if (capacityRatio < 1.1) riskLevel = 'high'
  else riskLevel = 'critical'

  // Per-category analysis
  const currentCategorySpend = new Map<string, number>()
  for (const t of currentMonthTransactions) {
    if (t.amount <= 0) continue
    const cat = t.category || 'Uncategorized'
    currentCategorySpend.set(cat, (currentCategorySpend.get(cat) || 0) + t.amount)
  }

  const historicalCategoryAvg = new Map<string, number>()
  const categoryMonthly = new Map<string, number[]>()
  for (const t of historicalTransactions) {
    if (t.amount <= 0 || getMonthKey(t.date) === monthKey) continue
    const cat = t.category || 'Uncategorized'
    if (!categoryMonthly.has(cat)) categoryMonthly.set(cat, [])
  }
  // Build monthly totals per category
  const catMonthTotals = new Map<string, Map<string, number>>()
  for (const t of historicalTransactions) {
    if (t.amount <= 0 || getMonthKey(t.date) === monthKey) continue
    const cat = t.category || 'Uncategorized'
    const mk = getMonthKey(t.date)
    if (!catMonthTotals.has(cat)) catMonthTotals.set(cat, new Map())
    const monthMap = catMonthTotals.get(cat)!
    monthMap.set(mk, (monthMap.get(mk) || 0) + t.amount)
  }
  for (const [cat, monthMap] of catMonthTotals) {
    historicalCategoryAvg.set(cat, mean([...monthMap.values()]))
  }

  const contributingCategories: OverspendingRiskResult['contributingCategories'] = []
  for (const [cat, spent] of currentCategorySpend) {
    const avg = historicalCategoryAvg.get(cat) || 0
    // Prorate: compare current spending pace to historical monthly average
    const projectedCatSpend = dayNum > 0 ? (spent / dayNum) * (dayNum + remaining) : spent
    const overage = projectedCatSpend - avg
    if (overage > 0 && avg > 0) {
      contributingCategories.push({ category: cat, spent, average: Math.round(avg), overage: Math.round(overage) })
    }
  }
  contributingCategories.sort((a, b) => b.overage - a.overage)

  // Explanation
  let explanation: string
  if (riskLevel === 'low') {
    explanation = "You're on track this month. Spending is well within your means."
  } else if (riskLevel === 'medium') {
    explanation = 'Spending is picking up. Keep an eye on discretionary purchases.'
  } else if (riskLevel === 'high') {
    const topCat = contributingCategories[0]
    explanation = topCat
      ? `You're likely to overspend this month. ${topCat.category} is ${formatCurrency(topCat.overage)} above average.`
      : "You're approaching your spending limit for this month."
  } else {
    explanation = `At the current pace, you'll exceed your budget by ${formatCurrency(projectedDeficit)}.`
  }

  return {
    riskLevel,
    projectedMonthlySpend: Math.round(projectedMonthlySpend),
    projectedDeficit: Math.round(projectedDeficit),
    burnRate: Math.round(burnRate * 100) / 100,
    historicalBurnRate: Math.round(historicalBurnRate * 100) / 100,
    contributingCategories: contributingCategories.slice(0, 5),
    explanation,
  }
}
