import { useMemo } from 'react'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestments } from '../hooks/useInvestments'
import { useNetWorth } from '../hooks/useNetWorth'
import { formatCurrency, getCategoryColor, formatCategoryName, CHART_COLORS, currentMonthKey } from '../lib/engines/utils'
import { computeNetWorth } from '../lib/engines/net-worth'
import { computeCashOptimization } from '../lib/engines/cash-optimization'
import { computeInvestmentPortfolio } from '../lib/engines/investment-portfolio'
import {
  Card, ChartLabel, StatCard,
  chartTooltipStyle as tt, chartAxisProps as ax, CHART_HEIGHT,
} from '../components/ui'

// ═══ Insight type ═══

interface Insight {
  title: string
  text: string
  type: 'good' | 'warning' | 'action' | 'info'
  chart?: React.ReactNode
}

const insightBorder: Record<Insight['type'], string> = {
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  action: 'border-l-rose-500',
  info: 'border-l-blue-500',
}

const insightBg: Record<Insight['type'], string> = {
  good: 'bg-emerald-500/5',
  warning: 'bg-amber-500/5',
  action: 'bg-rose-500/5',
  info: 'bg-blue-500/5',
}

const insightLabel: Record<Insight['type'], { text: string; color: string }> = {
  good: { text: 'Good', color: 'text-emerald-400' },
  warning: { text: 'Warning', color: 'text-amber-400' },
  action: { text: 'Action', color: 'text-rose-400' },
  info: { text: 'Info', color: 'text-blue-400' },
}

// ═══ Inline progress bar ═══

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="mt-3">
      {label && <p className="text-[10px] text-gray-500 mb-1">{label}</p>}
      <div className="w-full bg-[#252839] rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{pct.toFixed(0)}%</p>
    </div>
  )
}

// ═══ Inline stat ═══

function InlineStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mt-3 bg-[#252839] rounded-xl px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

// ═══ Main page ═══

export function Analysis() {
  const { transactions, loading } = useTransactions({ months: 12 })
  const { accounts } = useAccounts()
  const { holdings } = useInvestments()
  const { snapshots } = useNetWorth(365)

  const now = new Date()
  const monthKey = currentMonthKey()

  const nw = useMemo(() => computeNetWorth(accounts, snapshots), [accounts, snapshots])
  const monthlyExpenses = useMemo(
    () => transactions.filter((t) => t.date.startsWith(monthKey) && t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions, monthKey],
  )
  const cashOpt = useMemo(() => computeCashOptimization(accounts, monthlyExpenses), [accounts, monthlyExpenses])
  const portfolio = useMemo(() => computeInvestmentPortfolio(holdings), [holdings])

  // ── Monthly breakdown (12 months) ──

  const monthlyTrend = useMemo(() => {
    const months: { month: string; key: string; spent: number; income: number; savings: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const mTxns = transactions.filter((t) => t.date.startsWith(key))
      const spent = mTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const income = mTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      months.push({ month: label, key, spent: Math.round(spent), income: Math.round(income), savings: Math.round(income - spent) })
    }
    return months
  }, [transactions])

  // ── Category spending by current month ──

  const currentMonthCategoryMap = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter((t) => t.amount > 0 && t.date.startsWith(monthKey)).forEach((t) => {
      const cat = t.category || 'Uncategorized'
      map.set(cat, (map.get(cat) || 0) + t.amount)
    })
    return map
  }, [transactions, monthKey])

  // ── Previous month category spending ──

  const prevMonthKey = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const prevMonthCategoryMap = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter((t) => t.amount > 0 && t.date.startsWith(prevMonthKey)).forEach((t) => {
      const cat = t.category || 'Uncategorized'
      map.set(cat, (map.get(cat) || 0) + t.amount)
    })
    return map
  }, [transactions, prevMonthKey])

  // ── Top merchants (current month) ──

  const topMerchants = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter((t) => t.amount > 0 && t.date.startsWith(monthKey)).forEach((t) => {
      const n = t.merchant_name || t.name
      map.set(n, (map.get(n) || 0) + t.amount)
    })
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [transactions, monthKey])

  // ── 3-month average spending ──

  const threeMonthAvgSpend = useMemo(() => {
    const recent = monthlyTrend.slice(-4, -1) // 3 months before current
    if (recent.length === 0) return 0
    return recent.reduce((s, m) => s + m.spent, 0) / recent.length
  }, [monthlyTrend])

  // ── Derived values ──

  const currentMonthSpent = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].spent : 0
  const currentMonthIncome = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1].income : 0
  const prevMonthSpent = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2].spent : 0
  const momChange = prevMonthSpent > 0 ? ((currentMonthSpent - prevMonthSpent) / prevMonthSpent) * 100 : 0
  const savingsRate = currentMonthIncome > 0 ? ((currentMonthIncome - currentMonthSpent) / currentMonthIncome) * 100 : 0

  const totalCash = accounts.filter((a) => a.type === 'depository').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalInvest = accounts.filter((a) => a.type === 'investment').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalDebt = accounts.filter((a) => a.type === 'credit' || a.type === 'loan').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalAssets = totalCash + totalInvest
  const cashPct = totalAssets > 0 ? (totalCash / totalAssets) * 100 : 0
  const debtToAssetRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0

  // ── Category data for chart ──

  const topCategories = useMemo(() => {
    return [...currentMonthCategoryMap.entries()]
      .map(([name, value]) => ({
        name: formatCategoryName(name),
        rawName: name,
        value: Math.round(value),
        fill: getCategoryColor(name),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [currentMonthCategoryMap])

  // ═══ Generate spending insights ═══

  const spendingInsights = useMemo(() => {
    const insights: Insight[] = []
    let idx = 0

    // 1. Savings rate
    if (currentMonthIncome > 0) {
      const savingsType: Insight['type'] = savingsRate >= 30 ? 'good' : savingsRate >= 20 ? 'info' : savingsRate >= 0 ? 'warning' : 'action'
      insights.push({
        title: `Your savings rate is ${savingsRate.toFixed(0)}%`,
        text: savingsRate >= 30
          ? 'Excellent — you are saving well above the 20% minimum target.'
          : savingsRate >= 20
            ? 'You are meeting the 20% minimum savings target. Push for 30% for faster wealth building.'
            : savingsRate >= 0
              ? `Below the recommended 20% target. You saved ${formatCurrency(currentMonthIncome - currentMonthSpent)} of ${formatCurrency(currentMonthIncome)} earned.`
              : `You are spending more than you earn this month — ${formatCurrency(currentMonthSpent)} spent vs ${formatCurrency(currentMonthIncome)} income.`,
        type: savingsType,
        chart: (
          <ProgressBar
            value={Math.max(savingsRate, 0)}
            max={30}
            color={savingsRate >= 20 ? '#10b981' : '#f59e0b'}
            label={`${savingsRate.toFixed(0)}% of 30% target`}
          />
        ),
      })
    }

    // 2. Month-over-month change with top category driver
    if (prevMonthSpent > 0) {
      // Find category with biggest increase
      let biggestIncreaseCat = ''
      let biggestIncrease = 0
      for (const [cat, val] of currentMonthCategoryMap.entries()) {
        const prev = prevMonthCategoryMap.get(cat) || 0
        const diff = val - prev
        if (diff > biggestIncrease) {
          biggestIncrease = diff
          biggestIncreaseCat = cat
        }
      }

      if (momChange > 10) {
        const catNote = biggestIncreaseCat
          ? ` Biggest driver: ${formatCategoryName(biggestIncreaseCat)} (+${formatCurrency(biggestIncrease)}).`
          : ''
        insights.push({
          title: `Spending up ${momChange.toFixed(0)}% vs last month`,
          text: `You spent ${formatCurrency(currentMonthSpent)} this month vs ${formatCurrency(prevMonthSpent)} last month.${catNote}`,
          type: momChange > 30 ? 'action' : 'warning',
          chart: (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={[
                  { name: 'Last Mo', value: prevMonthSpent },
                  { name: 'This Mo', value: currentMonthSpent },
                ]}>
                  <XAxis dataKey="name" {...ax} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#6b7280" />
                    <Cell fill={momChange > 30 ? '#f43f5e' : '#f59e0b'} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        })
      } else if (momChange < -10) {
        insights.push({
          title: `Spending down ${Math.abs(momChange).toFixed(0)}% vs last month`,
          text: `Good trend — you spent ${formatCurrency(Math.abs(currentMonthSpent - prevMonthSpent))} less than last month.`,
          type: 'good',
          chart: (
            <InlineStat label="Saved vs last month" value={formatCurrency(prevMonthSpent - currentMonthSpent)} color="#10b981" />
          ),
        })
      }
    }

    // 3. Current month vs 3-month average
    if (threeMonthAvgSpend > 0) {
      const vsAvg = ((currentMonthSpent - threeMonthAvgSpend) / threeMonthAvgSpend) * 100
      if (vsAvg > 15) {
        insights.push({
          title: `${vsAvg.toFixed(0)}% above your 3-month average`,
          text: `This month's spending (${formatCurrency(currentMonthSpent)}) is above your 3-month average of ${formatCurrency(threeMonthAvgSpend)}.`,
          type: 'warning',
          chart: (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={[
                  { name: '3-Mo Avg', value: Math.round(threeMonthAvgSpend) },
                  { name: 'This Mo', value: currentMonthSpent },
                ]}>
                  <XAxis dataKey="name" {...ax} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill="#6b7280" />
                    <Cell fill="#f59e0b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        })
      } else if (vsAvg < -10) {
        insights.push({
          title: `${Math.abs(vsAvg).toFixed(0)}% below your 3-month average`,
          text: `Nice — you are spending less than your recent average of ${formatCurrency(threeMonthAvgSpend)}.`,
          type: 'good',
        })
      }
    }

    // 4. Top 3 merchants concentration
    if (topMerchants.length >= 3 && currentMonthSpent > 0) {
      const top3Total = topMerchants.slice(0, 3).reduce((s, m) => s + m.total, 0)
      const top3Pct = (top3Total / currentMonthSpent) * 100
      if (top3Pct > 50) {
        const merchantNames = topMerchants.slice(0, 3).map((m) => m.name.length > 18 ? m.name.substring(0, 18) + '...' : m.name)
        insights.push({
          title: `Top 3 merchants = ${top3Pct.toFixed(0)}% of spending`,
          text: `${merchantNames.join(', ')} account for over half your spending this month.`,
          type: 'info',
          chart: (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={topMerchants.slice(0, 3).map((m) => ({
                  name: m.name.length > 14 ? m.name.substring(0, 14) + '...' : m.name,
                  value: Math.round(m.total),
                }))} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" {...ax} width={110} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topMerchants.slice(0, 3).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        })
      }
    }

    // 5. Category spending breakdown (top categories chart)
    if (topCategories.length > 0) {
      insights.push({
        title: 'Spending by category this month',
        text: `Your top category is ${topCategories[0].name} at ${formatCurrency(topCategories[0].value)}.`,
        type: 'info',
        chart: (
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={Math.min(topCategories.length * 28 + 10, 180)}>
              <BarChart data={topCategories} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" {...ax} width={120} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {topCategories.map((c, i) => (<Cell key={i} fill={c.fill} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ),
      })
    }

    // 6. Months where spending exceeded income
    const deficitMonths = monthlyTrend.filter((m) => m.savings < 0).length
    if (deficitMonths >= 3) {
      insights.push({
        title: `Overspent in ${deficitMonths} of last 12 months`,
        text: 'You spent more than you earned in multiple months. Review recurring expenses for cuts.',
        type: 'action',
      })
    }

    return insights
  }, [
    currentMonthIncome, currentMonthSpent, savingsRate, prevMonthSpent, momChange,
    threeMonthAvgSpend, topMerchants, topCategories, monthlyTrend,
    currentMonthCategoryMap, prevMonthCategoryMap,
  ])

  // ═══ Generate portfolio insights ═══

  const portfolioInsights = useMemo(() => {
    const insights: Insight[] = []

    // 1. Cash allocation
    if (totalAssets > 0) {
      const cashType: Insight['type'] = cashPct > 70 ? 'action' : cashPct > 40 ? 'warning' : 'good'
      insights.push({
        title: `${cashPct.toFixed(0)}% of assets in cash`,
        text: cashPct > 70
          ? 'Most of your wealth is sitting in cash. Consider investing more for long-term growth.'
          : cashPct > 40
            ? 'Cash allocation is above the recommended 40% target. Explore low-risk investment options.'
            : 'Your cash-to-investment ratio looks balanced.',
        type: cashType,
        chart: (
          <div className="mt-3">
            <div className="flex h-6 rounded-lg overflow-hidden">
              {totalCash > 0 && (
                <div className="h-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${cashPct}%` }}>
                  {cashPct >= 15 ? `${cashPct.toFixed(0)}% Cash` : ''}
                </div>
              )}
              {totalInvest > 0 && (
                <div className="h-full bg-purple-500 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${100 - cashPct}%` }}>
                  {(100 - cashPct) >= 15 ? `${(100 - cashPct).toFixed(0)}% Invested` : ''}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-blue-400">{formatCurrency(totalCash)}</span>
              <span className="text-[10px] text-purple-400">{formatCurrency(totalInvest)}</span>
            </div>
          </div>
        ),
      })
    }

    // 2. Emergency fund
    if (monthlyExpenses > 0) {
      const efMonths = cashOpt.emergencyFundMonths
      const efType: Insight['type'] = efMonths >= 6 ? 'good' : efMonths >= 3 ? 'info' : 'action'
      insights.push({
        title: `Emergency fund covers ${efMonths.toFixed(1)} months`,
        text: efMonths >= 6
          ? 'Strong safety net. You have more than 6 months of expenses in cash reserves.'
          : efMonths >= 3
            ? 'You meet the minimum 3-month recommendation. Building to 6 months is ideal.'
            : `You need ${formatCurrency(monthlyExpenses * 3 - totalCash)} more to reach 3 months of expenses.`,
        type: efType,
        chart: (
          <ProgressBar
            value={efMonths}
            max={6}
            color={efMonths >= 3 ? '#10b981' : '#f43f5e'}
            label={`${efMonths.toFixed(1)} of 6 months target`}
          />
        ),
      })
    }

    // 3. Debt-to-asset ratio
    if (totalDebt > 0 && totalAssets > 0) {
      const dType: Insight['type'] = debtToAssetRatio > 50 ? 'action' : debtToAssetRatio > 30 ? 'warning' : 'good'
      insights.push({
        title: `Debt-to-asset ratio: ${debtToAssetRatio.toFixed(0)}%`,
        text: debtToAssetRatio > 50
          ? 'Your debt is over half your assets. Prioritize paying down high-interest debt.'
          : debtToAssetRatio > 30
            ? 'Moderate debt level. Consider accelerating payments on highest-rate balances.'
            : 'Healthy debt level relative to your assets.',
        type: dType,
        chart: (
          <InlineStat label="Total debt" value={formatCurrency(totalDebt)} color={debtToAssetRatio > 50 ? '#f43f5e' : '#f59e0b'} />
        ),
      })
    }

    // 4. Idle cash
    if (cashOpt.idleCash > 5000) {
      insights.push({
        title: `${formatCurrency(cashOpt.idleCash)} idle beyond emergency fund`,
        text: 'This cash could earn more in a high-yield savings account or diversified investments.',
        type: 'info',
        chart: (
          <InlineStat label="Recommended to invest" value={formatCurrency(cashOpt.recommendedInvestment)} color="#8b5cf6" />
        ),
      })
    }

    // 5. Portfolio diversification
    if (holdings.length > 0) {
      const score = portfolio.diversificationScore
      const dType: Insight['type'] = score >= 60 ? 'good' : score >= 30 ? 'warning' : 'action'
      insights.push({
        title: `Diversification score: ${score}/100`,
        text: score >= 60
          ? 'Your portfolio is well-diversified across holdings.'
          : score >= 30
            ? 'Moderate diversification. Spreading across more asset classes can reduce risk.'
            : `Portfolio is concentrated in ${holdings.length} holding${holdings.length === 1 ? '' : 's'}. Consider diversifying.`,
        type: dType,
        chart: (
          <ProgressBar
            value={score}
            max={100}
            color={score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#f43f5e'}
            label={`${score}/100`}
          />
        ),
      })
    }

    // 6. Investment return
    if (portfolio.totalReturnPercent != null && portfolio.totalGainLoss != null) {
      const ret = portfolio.totalReturnPercent
      const rType: Insight['type'] = ret >= 0 ? 'good' : 'warning'
      insights.push({
        title: `Portfolio return: ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%`,
        text: ret >= 0
          ? `Your investments have gained ${formatCurrency(portfolio.totalGainLoss)} overall.`
          : `Your investments are down ${formatCurrency(Math.abs(portfolio.totalGainLoss))}. Stay the course with long-term holdings.`,
        type: rType,
        chart: (
          <InlineStat
            label="Total gain/loss"
            value={`${ret >= 0 ? '+' : ''}${formatCurrency(portfolio.totalGainLoss)}`}
            color={ret >= 0 ? '#10b981' : '#f43f5e'}
          />
        ),
      })
    }

    return insights
  }, [
    totalAssets, totalCash, totalInvest, totalDebt, cashPct, debtToAssetRatio,
    monthlyExpenses, cashOpt, holdings, portfolio,
  ])

  // ═══ Render ═══

  if (loading) return <div className="p-6"><p className="text-sm text-gray-500">Loading...</p></div>

  const allSpending = spendingInsights.length
  const allPortfolio = portfolioInsights.length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Insights</h1>
        <p className="text-sm text-gray-500 mt-1">Smart, actionable takeaways from your financial data</p>
      </div>

      {/* ═══ Quick stats ═══ */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="This Month Spent" value={currentMonthSpent} color="#6366f1" format="currency" />
        <StatCard label="Savings Rate" value={savingsRate} color={savingsRate >= 20 ? '#10b981' : '#f59e0b'} />
        <StatCard label="Net Worth" value={nw.netWorth} color="#8b5cf6" format="currency" change={nw.monthlyChange} />
        <StatCard label="Emergency Fund" value={cashOpt.emergencyFundMonths} color="#06b6d4" />
      </div>

      {/* ═══ SPENDING INSIGHTS ═══ */}
      {allSpending > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
            Spending Insights
          </h2>
          <div className="space-y-4">
            {spendingInsights.map((insight, i) => (
              <Card key={i} className={`border-l-4 ${insightBorder[insight.type]} ${insightBg[insight.type]}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-white">
                    Insight {i + 1}: {insight.title}
                  </p>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${insightLabel[insight.type].color}`}>
                    {insightLabel[insight.type].text}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{insight.text}</p>
                {insight.chart}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PORTFOLIO INSIGHTS ═══ */}
      {allPortfolio > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-emerald-500" />
            Portfolio Insights
          </h2>
          <div className="space-y-4">
            {portfolioInsights.map((insight, i) => (
              <Card key={i} className={`border-l-4 ${insightBorder[insight.type]} ${insightBg[insight.type]}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-white">
                    Insight {allSpending + i + 1}: {insight.title}
                  </p>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${insightLabel[insight.type].color}`}>
                    {insightLabel[insight.type].text}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{insight.text}</p>
                {insight.chart}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allSpending === 0 && allPortfolio === 0 && (
        <Card>
          <p className="text-sm text-gray-500 text-center py-8">
            Not enough data to generate insights yet. Connect accounts and add transactions to get started.
          </p>
        </Card>
      )}
    </div>
  )
}
