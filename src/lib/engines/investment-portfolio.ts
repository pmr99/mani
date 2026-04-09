import type { InvestmentHolding } from '../../types/database'
import type { InvestmentPortfolioResult, InvestmentHoldingView } from '../../types/engines'

export function computeInvestmentPortfolio(
  holdings: InvestmentHolding[]
): InvestmentPortfolioResult {
  if (holdings.length === 0) {
    return {
      totalValue: 0,
      totalCostBasis: null,
      totalGainLoss: null,
      totalReturnPercent: null,
      holdings: [],
      allocationByClass: [],
      topHoldings: [],
      diversificationScore: 0,
    }
  }

  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0)
  const hasCostBasis = holdings.some((h) => h.cost_basis != null)
  const totalCostBasis = hasCostBasis
    ? holdings.reduce((s, h) => s + (h.cost_basis ?? 0), 0)
    : null
  const totalGainLoss = totalCostBasis != null ? totalValue - totalCostBasis : null
  const totalReturnPercent = totalCostBasis != null && totalCostBasis > 0
    ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
    : null

  // Build holding views
  const holdingViews: InvestmentHoldingView[] = holdings
    .map((h) => {
      const weight = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
      const gainLoss = h.cost_basis != null ? h.current_value - h.cost_basis : null
      const gainLossPercent = h.cost_basis != null && h.cost_basis > 0
        ? ((h.current_value - h.cost_basis) / h.cost_basis) * 100
        : null

      return {
        securityName: h.security_name,
        tickerSymbol: h.ticker_symbol,
        quantity: h.quantity,
        currentValue: h.current_value,
        costBasis: h.cost_basis,
        weight: Math.round(weight * 10) / 10,
        assetClass: h.asset_class,
        gainLoss: gainLoss != null ? Math.round(gainLoss * 100) / 100 : null,
        gainLossPercent: gainLossPercent != null ? Math.round(gainLossPercent * 10) / 10 : null,
      }
    })
    .sort((a, b) => b.currentValue - a.currentValue)

  // Allocation by asset class
  const classMap = new Map<string, number>()
  for (const h of holdings) {
    classMap.set(h.asset_class, (classMap.get(h.asset_class) || 0) + h.current_value)
  }
  const allocationByClass = [...classMap.entries()]
    .map(([assetClass, value]) => ({
      assetClass,
      value: Math.round(value * 100) / 100,
      weight: totalValue > 0 ? Math.round((value / totalValue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // Top 5 holdings
  const topHoldings = holdingViews.slice(0, 5)

  // Diversification score: based on number of holdings and concentration
  // Higher is more diversified (0-100)
  const topWeight = holdingViews.length > 0 ? holdingViews[0].weight : 100
  const numHoldings = holdingViews.length
  const concentrationPenalty = Math.max(0, topWeight - 20) // penalize if top holding > 20%
  const countBonus = Math.min(numHoldings * 5, 50) // up to 50 points for number of holdings
  const diversificationScore = Math.max(0, Math.min(100, countBonus + (50 - concentrationPenalty)))

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalCostBasis: totalCostBasis != null ? Math.round(totalCostBasis * 100) / 100 : null,
    totalGainLoss: totalGainLoss != null ? Math.round(totalGainLoss * 100) / 100 : null,
    totalReturnPercent: totalReturnPercent != null ? Math.round(totalReturnPercent * 10) / 10 : null,
    holdings: holdingViews,
    allocationByClass,
    topHoldings,
    diversificationScore: Math.round(diversificationScore),
  }
}
