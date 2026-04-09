import type { Account } from '../../types/database'
import type { CashOptimizationResult } from '../../types/engines'
import { formatCurrency } from './utils'

export function computeCashOptimization(
  accounts: Account[],
  monthlyExpenses: number
): CashOptimizationResult {
  const cashBalance = accounts
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0)

  const investmentBalance = accounts
    .filter((a) => a.type === 'investment')
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0)

  const totalAssets = cashBalance + investmentBalance
  const emergencyFund = monthlyExpenses * 3
  const emergencyFundMonths = monthlyExpenses > 0 ? cashBalance / monthlyExpenses : 0
  const idleCash = Math.max(0, cashBalance - emergencyFund)
  const recommendedInvestment = Math.round(idleCash * 0.6)
  const cashRatio = totalAssets > 0 ? cashBalance / totalAssets : 0

  const insights: string[] = []

  if (idleCash > 1000) {
    insights.push(
      `You have ${formatCurrency(idleCash)} beyond a 3-month emergency fund. Consider putting some to work.`
    )
  }

  if (cashRatio > 0.4 && investmentBalance > 0) {
    insights.push(
      `${Math.round(cashRatio * 100)}% of your assets are in cash, which is above typical ranges for long-term growth.`
    )
  }

  if (emergencyFundMonths < 3 && monthlyExpenses > 0) {
    insights.push(
      `Your emergency fund covers ${emergencyFundMonths.toFixed(1)} months. Aim for at least 3 months of expenses (${formatCurrency(emergencyFund)}).`
    )
  }

  if (emergencyFundMonths >= 6) {
    insights.push(
      `You have ${emergencyFundMonths.toFixed(1)} months of expenses in cash — a very strong safety net.`
    )
  }

  return {
    idleCash: Math.round(idleCash * 100) / 100,
    recommendedInvestment,
    cashRatio: Math.round(cashRatio * 100) / 100,
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    insights,
  }
}
