import type { Transaction, NetWorthSnapshot } from '../../types/database'
import type { PerformanceResult } from '../../types/engines'
import { formatCurrency } from './utils'

export function computePerformance(
  investmentTransactions: Transaction[], // transfers into investment accounts
  currentInvestmentValue: number,
  snapshots: NetWorthSnapshot[]
): PerformanceResult {
  // Estimate net contributions: transfers into investment accounts
  // In Plaid, transfers between accounts may show as negative amounts (money leaving checking)
  // We look for transactions in investment accounts that look like contributions
  const contributions = investmentTransactions
    .filter((t) => t.amount < 0) // negative = money coming in (income/transfer in Plaid convention)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const withdrawals = investmentTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const netContributions = contributions - withdrawals

  // Get earliest snapshot investment balance as baseline
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const earliest = sorted.length > 0 ? sorted[0].investment_balance : 0

  // Market return = current value - earliest value - net contributions
  const totalGainLoss = currentInvestmentValue - earliest - netContributions
  const returnPercentage = (earliest + netContributions) > 0
    ? (totalGainLoss / (earliest + netContributions)) * 100
    : 0

  let explanation: string
  if (totalGainLoss > 0 && netContributions > 0) {
    explanation = `Your investments grew by ${formatCurrency(totalGainLoss)} from market performance, plus ${formatCurrency(netContributions)} you contributed.`
  } else if (totalGainLoss > 0) {
    explanation = `Market performance added ${formatCurrency(totalGainLoss)} to your portfolio.`
  } else if (totalGainLoss < 0) {
    explanation = `Markets pulled your portfolio down by ${formatCurrency(Math.abs(totalGainLoss))}, but you contributed ${formatCurrency(netContributions)}.`
  } else {
    explanation = 'Not enough data to calculate investment performance yet.'
  }

  return {
    totalContributions: Math.round(netContributions * 100) / 100,
    totalGainLoss: Math.round(totalGainLoss * 100) / 100,
    returnPercentage: Math.round(returnPercentage * 10) / 10,
    explanation,
  }
}
