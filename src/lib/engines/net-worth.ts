import type { Account, NetWorthSnapshot } from '../../types/database'
import type { NetWorthResult } from '../../types/engines'
import { formatCurrency, isCashAccount, isLiabilityAccount } from './utils'

export function computeNetWorth(
  accounts: Account[],
  snapshots: NetWorthSnapshot[]
): NetWorthResult {
  let cashBalance = 0
  let investmentBalance = 0
  let creditBalance = 0
  let loanBalance = 0

  for (const a of accounts) {
    const bal = a.current_balance ?? 0
    switch (a.type) {
      case 'depository':
        cashBalance += bal
        break
      case 'investment':
        investmentBalance += bal
        break
      case 'credit':
        // Plaid reports credit balance as positive (amount owed)
        creditBalance += bal
        break
      case 'loan':
        loanBalance += bal
        break
    }
  }

  const totalAssets = cashBalance + investmentBalance
  const totalLiabilities = creditBalance + loanBalance
  const netWorth = totalAssets - totalLiabilities

  // Monthly change from snapshots
  const sorted = [...snapshots].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
  const oldSnapshot = sorted.find((s) => s.snapshot_date <= thirtyDaysAgoStr)

  const monthlyChange = oldSnapshot ? netWorth - oldSnapshot.net_worth : 0
  const monthlyChangePercent = oldSnapshot && oldSnapshot.net_worth !== 0
    ? (monthlyChange / Math.abs(oldSnapshot.net_worth)) * 100
    : 0

  // Generate insights
  const insights: string[] = []

  if (monthlyChange > 0) {
    insights.push(`Your net worth grew by ${formatCurrency(monthlyChange)} this month.`)
  } else if (monthlyChange < 0) {
    insights.push(`Your net worth decreased by ${formatCurrency(Math.abs(monthlyChange))} this month.`)
  }

  if (totalLiabilities > 0) {
    const debtToAsset = totalAssets > 0 ? totalLiabilities / totalAssets : 0
    if (debtToAsset > 0.5) {
      insights.push(`Your debt is ${Math.round(debtToAsset * 100)}% of your assets. Focus on paying down high-interest debt.`)
    }
  }

  if (cashBalance > 0 && investmentBalance > 0) {
    const cashRatio = cashBalance / totalAssets
    if (cashRatio > 0.7) {
      insights.push('Most of your assets are in cash. Consider investing for long-term growth.')
    }
  }

  return {
    netWorth: Math.round(netWorth * 100) / 100,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    investmentBalance: Math.round(investmentBalance * 100) / 100,
    creditBalance: Math.round(creditBalance * 100) / 100,
    loanBalance: Math.round(loanBalance * 100) / 100,
    monthlyChange: Math.round(monthlyChange * 100) / 100,
    monthlyChangePercent: Math.round(monthlyChangePercent * 10) / 10,
    insights,
  }
}
