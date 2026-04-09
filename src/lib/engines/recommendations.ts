import type { RecommendationsInput, Recommendation, RecurringExpenseResult } from '../../types/engines'
import { formatCurrency } from './utils'

function findDuplicateSubscriptions(expenses: RecurringExpenseResult[]): RecurringExpenseResult[][] {
  const subs = expenses.filter((e) => e.isSubscription && !e.isDismissed)
  const groups = new Map<string, RecurringExpenseResult[]>()

  for (const sub of subs) {
    const cat = sub.category || 'other'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(sub)
  }

  return [...groups.values()].filter((g) => g.length >= 2)
}

export function generateRecommendations(input: RecommendationsInput): Recommendation[] {
  const { safeToSpend, overspendingRisk, recurringExpenses, accounts, monthlyExpenses, forecast } = input
  const recs: Recommendation[] = []
  let id = 0

  // 1. Safe to spend message
  if (safeToSpend) {
    if (safeToSpend.safeToSpendToday > 0) {
      recs.push({
        id: `rec-${id++}`,
        type: 'general',
        title: `You can safely spend ${formatCurrency(safeToSpend.safeToSpendToday)} today`,
        description: safeToSpend.explanation,
        impactAmount: safeToSpend.safeToSpendToday,
        urgency: 'low',
      })
    } else {
      recs.push({
        id: `rec-${id++}`,
        type: 'spending_adjustment',
        title: 'Hold off on spending today',
        description: safeToSpend.explanation,
        impactAmount: 0,
        urgency: 'high',
      })
    }
  }

  // 2. Overspending risk
  if (overspendingRisk && (overspendingRisk.riskLevel === 'high' || overspendingRisk.riskLevel === 'critical')) {
    const topCat = overspendingRisk.contributingCategories[0]
    if (topCat) {
      recs.push({
        id: `rec-${id++}`,
        type: 'spending_adjustment',
        title: `Reduce ${topCat.category.toLowerCase().replace(/_/g, ' ')} spending`,
        description: `You've spent ${formatCurrency(topCat.spent)} this month vs your ${formatCurrency(topCat.average)} average. Cut back by ${formatCurrency(topCat.overage)} to stay on track.`,
        impactAmount: topCat.overage,
        urgency: overspendingRisk.riskLevel === 'critical' ? 'high' : 'medium',
      })
    }
  }

  // 3. Duplicate subscriptions
  const dupes = findDuplicateSubscriptions(recurringExpenses)
  for (const group of dupes.slice(0, 2)) {
    const names = group.map((s) => s.normalizedName).join(', ')
    const totalMonthly = group.reduce((s, e) => s + e.amount, 0)
    recs.push({
      id: `rec-${id++}`,
      type: 'subscription',
      title: `Review: ${group.length} similar subscriptions`,
      description: `You're paying ${formatCurrency(totalMonthly)}/mo for: ${names}. Consider consolidating.`,
      impactAmount: group[group.length - 1].amount, // potential savings
      urgency: 'low',
    })
  }

  // 4. Excess cash — suggest investing
  const cashBalance = accounts
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0)
  const emergencyFund = monthlyExpenses * 3
  const idleCash = cashBalance - emergencyFund

  if (idleCash > 1000) {
    const recommended = Math.round(idleCash * 0.6) // suggest investing 60% of idle cash
    recs.push({
      id: `rec-${id++}`,
      type: 'cash_management',
      title: `Consider investing ${formatCurrency(recommended)}`,
      description: `You have ${formatCurrency(idleCash)} beyond a 3-month emergency fund. Putting some to work could accelerate your goals.`,
      impactAmount: recommended,
      urgency: 'low',
    })
  }

  // 5. Forecast risk
  if (forecast && forecast.riskOfNegative) {
    recs.push({
      id: `rec-${id++}`,
      type: 'spending_adjustment',
      title: `Balance may go negative in ${forecast.daysUntilNegative} days`,
      description: `Your projected minimum balance is ${formatCurrency(forecast.minBalance)} on ${forecast.minBalanceDate}. Reduce spending or ensure income arrives in time.`,
      impactAmount: Math.abs(forecast.minBalance),
      urgency: 'high',
    })
  }

  // Sort by urgency (high first), then by impact
  const urgencyOrder = { high: 0, medium: 1, low: 2 }
  recs.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.impactAmount - a.impactAmount)

  return recs.slice(0, 5)
}
