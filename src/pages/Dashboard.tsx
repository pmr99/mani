import { useMemo, useState, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, Cell, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, ReferenceArea,
} from 'recharts'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useNetWorth } from '../hooks/useNetWorth'
import { useInvestments } from '../hooks/useInvestments'
import { usePortfolioHistory } from '../hooks/usePortfolioHistory'
import { useCashHistory } from '../hooks/useCashHistory'
import { useRecurringExpenses } from '../hooks/useRecurringExpenses'
import { useGoals } from '../hooks/useGoals'
import { computeSafeToSpend } from '../lib/engines/safe-to-spend'
import { computeNetWorth } from '../lib/engines/net-worth'
import { computeInvestmentPortfolio } from '../lib/engines/investment-portfolio'
import { computeForecast } from '../lib/engines/forecasting'
import { SyncButton } from '../components/SyncButton'
import {
  Card, ChartLabel, SectionTitle, StatCard, MerchantBar, TransactionRow,
  BreakdownList, CategoryBadge, DonutChart, chartTooltipStyle as tt, chartAxisProps as ax, chartLegendStyle, CHART_HEIGHT,
} from '../components/ui'
import {
  formatCurrency, formatCurrencyCompact, getCategoryColor, formatCategoryName,
  currentMonthKey, todayStr, addDays, CHART_COLORS,
} from '../lib/engines/utils'

type Period = 'weekly' | 'monthly' | 'yearly' | '5y' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: '5y', label: '5Y' },
  { key: 'all', label: 'All' },
]

// Chart config imported from ui.tsx

function getMonthsForPeriod(p: Period): number | undefined {
  if (p === 'weekly') return 1
  if (p === 'monthly') return 2
  if (p === 'yearly') return 13
  if (p === '5y') return 61
  return undefined
}

function getNetWorthDays(p: Period): number {
  if (p === 'weekly') return 30
  if (p === 'monthly') return 90
  if (p === 'yearly') return 365
  if (p === '5y') return 1825
  return 3650
}

function getDateRange(p: Period): { start: string; end: string } {
  const end = todayStr()
  const now = new Date()
  if (p === 'weekly') return { start: addDays(end, -6), end }
  if (p === 'monthly') return { start: addDays(end, -29), end }
  if (p === 'yearly') { const s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); return { start: s.toISOString().split('T')[0], end } }
  if (p === '5y') { const s = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()); return { start: s.toISOString().split('T')[0], end } }
  return { start: '2000-01-01', end }
}

interface Bucket { label: string; income: number; expenses: number; net: number }

function bucketByPeriod(txns: { date: string; amount: number }[], period: Period, range: { start: string; end: string }): Bucket[] {
  if (period === 'weekly') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(range.start, i)
      const dayTxns = txns.filter((t) => t.date === d)
      const exp = dayTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const inc = dayTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      return { label: days[new Date(d).getDay()], income: Math.round(inc), expenses: Math.round(exp), net: Math.round(inc - exp) }
    })
  }
  if (period === 'monthly') {
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(range.start, i)
      const dayTxns = txns.filter((t) => t.date === d)
      const exp = dayTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const inc = dayTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      return { label: String(new Date(d).getDate()), income: Math.round(inc), expenses: Math.round(exp), net: Math.round(inc - exp) }
    })
  }
  // yearly, 5y, all — by month
  const map = new Map<string, { inc: number; exp: number }>()
  for (const t of txns) {
    const mk = t.date.substring(0, 7)
    if (!map.has(mk)) map.set(mk, { inc: 0, exp: 0 })
    const e = map.get(mk)!
    if (t.amount > 0) e.exp += t.amount; else e.inc += Math.abs(t.amount)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mk, v]) => {
    const d = new Date(mk + '-01')
    return { label: d.toLocaleDateString('en-US', { month: 'short', year: period !== 'yearly' ? '2-digit' : undefined }), income: Math.round(v.inc), expenses: Math.round(v.exp), net: Math.round(v.inc - v.exp) }
  })
}

// Card and ChartLabel imported from ui.tsx

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('monthly')
  const range = getDateRange(period) // only for overview strip

  const { accounts } = useAccounts()
  // Fetch all transactions (sections control their own time ranges)
  const { transactions: allTxns, refetch } = useTransactions({ all: true })
  const { snapshots } = useNetWorth(365) // always fetch 1 year of snapshots
  const { holdings } = useInvestments()

  // Investment chart toggles (must be before usePortfolioHistory)
  const [investView, setInvestView] = useState<'overall' | 'account' | 'holding'>('overall')
  const [investRange, setInvestRange] = useState(30)

  const { timeline: portfolioTimeline, byAccount: portfolioByAccount, syncing: portfolioSyncing, syncHistory } = usePortfolioHistory({ days: investRange })

  // Cash chart toggles
  const [cashRange, setCashRange] = useState(90)
  const [cashView, setCashView] = useState<'overall' | 'account'>('overall')
  const { timeline: cashTimeline, byAccount: cashByAccount, syncing: cashSyncing } = useCashHistory({ days: cashRange })
  const { expenses: recurringExpenses } = useRecurringExpenses()
  const { totalMonthlyContributions } = useGoals()

  // === Overview strip data (controlled by global period toggle) ===
  const overviewTxns = useMemo(() => allTxns.filter((t) => t.date >= range.start && t.date <= range.end), [allTxns, range])
  const totalIncome = overviewTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalExpenses = overviewTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  const investAccounts = useMemo(() => accounts.filter((a) => a.type === 'investment'), [accounts])
  const totalCash = accounts.filter((a) => a.type === 'depository').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalInvest = investAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalCredit = accounts.filter((a) => a.type === 'credit').reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const nwResult = useMemo(() => computeNetWorth(accounts, snapshots), [accounts, snapshots])
  const portfolio = useMemo(() => computeInvestmentPortfolio(holdings), [holdings])

  // === Section-independent data (not affected by global period) ===
  const monthKey = currentMonthKey()
  const thisMonthTxns = useMemo(() => allTxns.filter((t) => t.date.startsWith(monthKey)), [allTxns, monthKey])
  const safeToSpend = useMemo(
    () => computeSafeToSpend({ accounts, recurringExpenses, currentMonthTransactions: thisMonthTxns, goalContributions: totalMonthlyContributions }),
    [accounts, recurringExpenses, thisMonthTxns, totalMonthlyContributions]
  )
  const forecast = useMemo(
    () => computeForecast({ accounts, recurringExpenses, recentTransactions: allTxns }),
    [accounts, recurringExpenses, allTxns]
  )

  // Spending section uses all transactions (has its own filters)
  const spendingTxns = useMemo(() => allTxns.filter((t) => t.amount > 0), [allTxns])

  // Savings toggle: weekly vs monthly comparison
  const [cfView, setCfView] = useState<'weekly' | 'monthly'>('monthly')

  // Savings filtered transactions (matches cfView range)
  const cfTxns = useMemo(() => {
    const today = todayStr()
    const daysBack = cfView === 'weekly' ? 28 * 3 : 180 // 12 weeks or 6 months
    const start = addDays(today, -daysBack)
    return allTxns.filter((t) => t.date >= start && t.date <= today)
  }, [allTxns, cfView])

  const cfTotalIncome = cfTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const cfTotalExpenses = cfTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const cfNetSavings = cfTotalIncome - cfTotalExpenses
  const cfSavingsRate = cfTotalIncome > 0 ? ((cfTotalIncome - cfTotalExpenses) / cfTotalIncome) * 100 : 0

  // Hero card: last week or last month only
  const heroTxns = useMemo(() => {
    const t = todayStr()
    const daysBack = cfView === 'weekly' ? 7 : 30
    const start = addDays(t, -daysBack)
    return allTxns.filter((tx) => tx.date >= start && tx.date <= t)
  }, [allTxns, cfView])
  const heroIncome = heroTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const heroExpenses = heroTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const heroSavings = heroIncome - heroExpenses
  const heroSavingsRate = heroIncome > 0 ? ((heroIncome - heroExpenses) / heroIncome) * 100 : 0
  const [cfChartType, setCfChartType] = useState<'line' | 'bar'>('line')

  // Spending chart view toggle
  const [spendingView, setSpendingView] = useState<'overall' | 'account' | 'category'>('overall')
  const [spendingPeriod, setSpendingPeriod] = useState<'weekly' | 'monthly'>('weekly')

  // investView and investRange declared above (before usePortfolioHistory)

  // Drag-to-select state for cash flow chart
  const [cfDragStart, setCfDragStart] = useState<string | null>(null)
  const [cfDragEnd, setCfDragEnd] = useState<string | null>(null)
  const [cfSelection, setCfSelection] = useState<{ startLabel: string; endLabel: string; inflowDiff: number; outflowDiff: number; inflowPct: number; outflowPct: number } | null>(null)

  // Inflow/outflow breakdown by source (cross-referenced with accounts)
  const inflowBreakdown = useMemo(() => {
    const items: { name: string; value: number; color: string }[] = []
    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    const inflows = cfTxns.filter((t) => t.amount < 0)

    // Granular inflow buckets
    let salary = 0          // paychecks, direct deposits
    let retirement401k = 0  // 401k gains/contributions
    let retirementIRA = 0   // Roth/Traditional IRA
    let hysaMMF = 0         // HYSA, money market, savings interest
    let stockGains = 0      // brokerage / equity gains
    let bondGains = 0       // fixed income / bonds
    let otherInvest = 0     // other investment income
    let otherIncome = 0     // refunds, misc

    for (const t of inflows) {
      const abs = Math.abs(t.amount)
      const acct = accountMap.get(t.account_id)
      const sub = acct?.subtype?.toLowerCase() || ''
      const name = acct?.name?.toLowerCase() || ''

      if (t.category === 'INCOME') {
        // Salary / paycheck
        salary += abs
      } else if (acct?.type === 'investment') {
        // Classify by investment account subtype/name
        if (sub === '401k' || sub === '401a' || name.includes('401k') || name.includes('401(k)')) {
          retirement401k += abs
        } else if (sub === 'ira' || sub === 'roth' || sub === 'roth ira' || name.includes('ira') || name.includes('roth')) {
          retirementIRA += abs
        } else if (sub === 'brokerage' || name.includes('brokerage') || name.includes('individual')) {
          stockGains += abs
        } else {
          otherInvest += abs
        }
      } else if (acct?.type === 'depository') {
        // Classify depository inflows
        if (sub === 'money market' || sub === 'hsa' || name.includes('money market') || name.includes('mmf') || name.includes('hysa') || name.includes('hsa')) {
          hysaMMF += abs
        } else if (sub === 'savings' || name.includes('saving')) {
          hysaMMF += abs  // savings interest
        } else if (t.category === 'TRANSFER_IN') {
          otherIncome += abs  // internal transfers
        } else {
          otherIncome += abs
        }
      } else {
        otherIncome += abs
      }
    }

    // Also estimate unrealized gains from snapshot deltas (investment balance change)
    if (snapshots.length > 1) {
      const first = snapshots[0]
      const last = snapshots[snapshots.length - 1]
      const investDelta = last.investment_balance - first.investment_balance
      // If investment balance grew beyond what inflows account for, that's market gains
      const totalInvestInflows = retirement401k + retirementIRA + stockGains + bondGains + otherInvest
      const marketGain = Math.max(0, investDelta - totalInvestInflows)
      if (marketGain > 100) { // only show if meaningful
        stockGains += Math.round(marketGain)
      }
    }

    // Push in order of typical importance
    if (salary > 0) items.push({ name: 'Salary & Wages', value: Math.round(salary), color: '#10b981' })
    if (retirement401k > 0) items.push({ name: '401(k) Gains', value: Math.round(retirement401k), color: '#8b5cf6' })
    if (retirementIRA > 0) items.push({ name: 'IRA / Roth', value: Math.round(retirementIRA), color: '#a78bfa' })
    if (hysaMMF > 0) items.push({ name: 'HYSA / MMF / Savings', value: Math.round(hysaMMF), color: '#3b82f6' })
    if (stockGains > 0) items.push({ name: 'Stock Gains', value: Math.round(stockGains), color: '#f59e0b' })
    if (bondGains > 0) items.push({ name: 'Bond Gains', value: Math.round(bondGains), color: '#06b6d4' })
    if (otherInvest > 0) items.push({ name: 'Other Investment', value: Math.round(otherInvest), color: '#14b8a6' })
    if (otherIncome > 0) items.push({ name: 'Other Income', value: Math.round(otherIncome), color: '#6b7280' })
    return items
  }, [cfTxns, accounts, snapshots])

  const outflowBreakdown = useMemo(() => {
    const items: { name: string; value: number; color: string }[] = []
    const cfSpending = cfTxns.filter((t) => t.amount > 0)
    const catMap = new Map<string, number>()
    cfSpending.forEach((t) => {
      const c = t.category || 'OTHER'
      catMap.set(c, (catMap.get(c) || 0) + t.amount)
    })
    // Group into major buckets
    const spending = [...catMap.entries()]
      .filter(([c]) => !['LOAN_PAYMENTS', 'TRANSFER_OUT'].includes(c))
      .reduce((s, [, v]) => s + v, 0)
    const loanPayments = catMap.get('LOAN_PAYMENTS') || 0
    const transfers = catMap.get('TRANSFER_OUT') || 0
    const investLoss = snapshots.length > 1
      ? Math.max(0, snapshots[0]?.investment_balance - snapshots[snapshots.length - 1]?.investment_balance)
      : 0
    if (spending > 0) items.push({ name: 'Spending', value: Math.round(spending), color: '#6366f1' })
    if (loanPayments > 0) items.push({ name: 'Loan Payments', value: Math.round(loanPayments), color: '#f59e0b' })
    if (transfers > 0) items.push({ name: 'Transfers Out', value: Math.round(transfers), color: '#f43f5e' })
    if (investLoss > 0) items.push({ name: 'Investment Loss', value: Math.round(investLoss), color: '#ef4444' })
    return items
  }, [cfTxns, snapshots])

  // Cash flow data — weekly aggregates by week, monthly aggregates by month
  const cfComparisonData = useMemo(() => {
    const today = todayStr()
    if (cfView === 'weekly') {
      // Last 12 weeks, one bar per week
      const result: { label: string; inflow: number; outflow: number; net: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const weekEnd = addDays(today, -i * 7)
        const weekStart = addDays(weekEnd, -6)
        const weekTxns = allTxns.filter((t) => t.date >= weekStart && t.date <= weekEnd)
        const inflow = Math.round(weekTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0))
        const outflow = Math.round(weekTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))
        const startDt = new Date(weekStart)
        const label = startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        result.push({ label, inflow, outflow, net: inflow - outflow, netPositive: inflow - outflow > 0 ? inflow - outflow : null })
      }
      return result
    }
    // Monthly — one bar per month, last 6 months
    const result: { label: string; inflow: number; outflow: number; net: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mTxns = allTxns.filter((t) => t.date.startsWith(mk))
      const inflow = Math.round(mTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0))
      const outflow = Math.round(mTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))
      result.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), inflow, outflow, net: inflow - outflow, netPositive: inflow - outflow > 0 ? inflow - outflow : null })
    }
    return result
  }, [cfView, allTxns])

  const handleCfMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e?.activeLabel) { setCfDragStart(e.activeLabel); setCfDragEnd(null); setCfSelection(null) }
  }, [])

  const handleCfMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (cfDragStart && e?.activeLabel) setCfDragEnd(e.activeLabel)
  }, [cfDragStart])

  const handleCfMouseUp = useCallback(() => {
    if (cfDragStart && cfDragEnd && cfDragStart !== cfDragEnd) {
      const labels = cfComparisonData.map((d) => d.label)
      const si = labels.indexOf(cfDragStart)
      const ei = labels.indexOf(cfDragEnd)
      if (si >= 0 && ei >= 0) {
        const [startIdx, endIdx] = si < ei ? [si, ei] : [ei, si]
        const startD = cfComparisonData[startIdx]
        const endD = cfComparisonData[endIdx]
        const inflowDiff = endD.inflow - startD.inflow
        const outflowDiff = endD.outflow - startD.outflow
        const inflowPct = startD.inflow > 0 ? (inflowDiff / startD.inflow) * 100 : 0
        const outflowPct = startD.outflow > 0 ? (outflowDiff / startD.outflow) * 100 : 0
        setCfSelection({ startLabel: cfComparisonData[startIdx].label, endLabel: cfComparisonData[endIdx].label, inflowDiff, outflowDiff, inflowPct, outflowPct })
      }
    }
    setCfDragStart(null)
    setCfDragEnd(null)
  }, [cfDragStart, cfDragEnd, cfComparisonData])

  // Spending section filtered transactions (matches spendingPeriod)
  const spendingFilteredTxns = useMemo(() => {
    const today = todayStr()
    const daysBack = spendingPeriod === 'weekly' ? 84 : 180
    const start = addDays(today, -daysBack)
    return spendingTxns.filter((t) => t.date >= start && t.date <= today)
  }, [spendingTxns, spendingPeriod])

  // Spending categories (filtered by spending period)
  const spendingCategories = useMemo(() => {
    const map = new Map<string, number>()
    spendingFilteredTxns.forEach((t) => { const c = t.category || 'OTHER'; map.set(c, (map.get(c) || 0) + t.amount) })
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [spendingFilteredTxns])

  // Top merchants (filtered by spending period) — truncate long names
  const topMerchants = useMemo(() => {
    const map = new Map<string, number>()
    spendingFilteredTxns.forEach((t) => {
      let n = t.merchant_name || t.name
      n = n.replace(/ACH Electronic Credit/gi, '').replace(/AUTOMATIC PAYMENT - THANK/gi, 'Auto Payment').trim()
      if (n.length > 18) n = n.substring(0, 18).trim() + '...'
      map.set(n, (map.get(n) || 0) + t.amount)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [spendingFilteredTxns])

  // Spending buckets — uses its own period (daily/weekly/monthly)
  const spendingBucketData = useMemo(() => {
    const today = todayStr()
    type BucketInfo = { label: string; start: string; end: string }
    let buckets: BucketInfo[] = []

    if (spendingPeriod === 'weekly') {
      // Last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const end = addDays(today, -i * 7)
        const start = addDays(end, -6)
        buckets.push({ label: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), start, end })
      }
    } else {
      // Last 6 months
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        buckets.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), start: `${mk}-01`, end: `${mk}-${lastDay}` })
      }
    }
    return buckets
  }, [spendingPeriod])

  const spendingBuckets = useMemo(() => {
    return spendingBucketData.map((b) => {
      const val = spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end).reduce((s, t) => s + t.amount, 0)
      return { label: b.label, value: Math.round(val) }
    })
  }, [spendingBucketData, spendingTxns])

  // Spending by account over time
  const spendingByAccountBuckets = useMemo(() => {
    const accountIds = [...new Set(spendingTxns.map((t) => t.account_id))]
    return spendingBucketData.map((b) => {
      const row: Record<string, string | number> = { label: b.label }
      const bucketTxns = spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end)
      for (const aid of accountIds) {
        row[aid] = Math.round(bucketTxns.filter((t) => t.account_id === aid).reduce((s, t) => s + t.amount, 0))
      }
      return row
    })
  }, [spendingBucketData, spendingTxns])

  const spendingAccountKeys = useMemo(() => {
    const accountIds = [...new Set(spendingTxns.map((t) => t.account_id))]
    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    return accountIds.map((id, i) => ({
      key: id,
      name: accountMap.get(id)?.name ?? id.slice(0, 8),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [spendingTxns, accounts])

  // Spending by category over time (top 5)
  const topSpendingCategoryNames = useMemo(() => {
    return spendingCategories.slice(0, 5).map((c) => c.name)
  }, [spendingCategories])

  const spendingByCategoryBuckets = useMemo(() => {
    const cats = topSpendingCategoryNames
    return spendingBucketData.map((b) => {
      const row: Record<string, string | number> = { label: b.label }
      const bucketTxns = spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end)
      for (const cat of cats) {
        const sum = bucketTxns.filter((t) => (t.category || 'OTHER') === cat).reduce((s, t) => s + t.amount, 0)
        row[cat] = Math.round(sum)
      }
      return row
    })
  }, [spendingBucketData, spendingTxns, topSpendingCategoryNames])

  const spendingCategoryKeys = useMemo(() => {
    return topSpendingCategoryNames.map((name) => ({
      key: name,
      name: formatCategoryName(name),
      color: getCategoryColor(name),
    }))
  }, [topSpendingCategoryNames])

  // Investment timeline from snapshots
  const investTimeline = useMemo(() => snapshots.map((s) => ({ date: s.snapshot_date, value: s.investment_balance })), [snapshots])

  // Cash chart data
  const cashChartData = useMemo(() => {
    const fmtLabel = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (cashView === 'overall') {
      if (cashTimeline.length > 1) {
        return cashTimeline.map((p) => ({ label: fmtLabel(p.date), value: p.value }))
      }
      const today = todayStr()
      const start = addDays(today, -cashRange)
      return [{ label: fmtLabel(start), value: totalCash }, { label: fmtLabel(today), value: totalCash }]
    }
    // By account
    const cashAccts = accounts.filter((a) => a.type === 'depository')
    const allDates = [...new Set(Object.values(cashByAccount).flatMap((vals) => vals.map((v) => v.date)))].sort()
    if (allDates.length > 1) {
      return allDates.map((date) => {
        const row: Record<string, string | number> = { label: fmtLabel(date) }
        cashAccts.forEach((a) => {
          const dayVal = cashByAccount[a.id]?.find((v) => v.date === date)
          row[a.id] = dayVal?.value ?? 0
        })
        return row
      })
    }
    const today = todayStr()
    const start = addDays(today, -cashRange)
    const row1: Record<string, string | number> = { label: fmtLabel(start) }
    const row2: Record<string, string | number> = { label: fmtLabel(today) }
    cashAccts.forEach((a) => { row1[a.id] = a.current_balance ?? 0; row2[a.id] = a.current_balance ?? 0 })
    return [row1, row2]
  }, [cashTimeline, cashByAccount, cashView, cashRange, accounts, totalCash])

  const cashLineKeys = useMemo(() => {
    if (cashView !== 'account') return []
    return accounts.filter((a) => a.type === 'depository').map((a, i) => ({
      key: a.id,
      name: a.name.replace('Plaid ', ''),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [cashView, accounts])

  // Investment chart data — respects investRange and investView
  // Investment chart data — uses real portfolio_daily_values when available
  const investChartData = useMemo(() => {
    const fmtLabel = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (investView === 'overall') {
      // Use aggregated timeline from portfolio history
      if (portfolioTimeline.length > 1) {
        return portfolioTimeline.map((p) => ({ label: fmtLabel(p.date), value: p.value }))
      }
      // Fallback: flat line from current balance
      const today = todayStr()
      const start = addDays(today, -investRange)
      return [
        { label: fmtLabel(start), value: totalInvest },
        { label: fmtLabel(today), value: totalInvest },
      ]
    }

    if (investView === 'account') {
      // Multi-line per account from portfolio history
      const allDates = [...new Set(Object.values(portfolioByAccount).flatMap((vals) => vals.map((v) => v.date)))].sort()

      if (allDates.length > 1) {
        return allDates.map((date) => {
          const row: Record<string, string | number> = { label: fmtLabel(date) }
          investAccounts.forEach((a) => {
            const dayVal = portfolioByAccount[a.id]?.find((v) => v.date === date)
            row[a.id] = dayVal?.value ?? 0
          })
          return row
        })
      }
      // Fallback: flat lines from current balances
      const today = todayStr()
      const start = addDays(today, -investRange)
      const row1: Record<string, string | number> = { label: fmtLabel(start) }
      const row2: Record<string, string | number> = { label: fmtLabel(today) }
      investAccounts.forEach((a) => { row1[a.id] = a.current_balance ?? 0; row2[a.id] = a.current_balance ?? 0 })
      return [row1, row2]
    }

    // By holding — current values (no historical per-holding data)
    if (holdings.length > 0) {
      const today = todayStr()
      const start = addDays(today, -investRange)
      const topH = [...holdings].sort((a, b) => b.current_value - a.current_value).slice(0, 5)
      const row1: Record<string, string | number> = { label: fmtLabel(start) }
      const row2: Record<string, string | number> = { label: fmtLabel(today) }
      topH.forEach((h) => {
        const key = h.ticker_symbol || h.security_name
        row1[key] = h.current_value
        row2[key] = h.current_value
      })
      return [row1, row2]
    }
    return [{ label: 'Now', value: totalInvest }]
  }, [portfolioTimeline, portfolioByAccount, investRange, investView, investAccounts, holdings, totalInvest])

  // Line keys for multi-line investment chart
  const investLineKeys = useMemo(() => {
    if (investView === 'account') {
      return investAccounts.map((a, i) => ({
        key: a.id,
        name: a.name.replace('Plaid ', ''),
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    }
    if (investView === 'holding' && holdings.length > 0) {
      return holdings.sort((a, b) => b.current_value - a.current_value).slice(0, 5).map((h, i) => ({
        key: h.ticker_symbol || h.security_name,
        name: h.ticker_symbol || h.security_name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    }
    return []
  }, [investView, investAccounts, holdings])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {portfolioSyncing && <span className="text-xs text-purple-400 animate-pulse">Syncing investments...</span>}
      </div>

      {/* Summary Strip with its own period toggle */}
      <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Overview</p>
          <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${period === p.key ? 'bg-[#6366f1] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="Net Worth" value={nwResult.netWorth} color="#10b981" change={nwResult.monthlyChange} />
          <StatCard label="Income" value={totalIncome} color="#10b981" />
          <StatCard label="Expenses" value={totalExpenses} color="#f43f5e" />
          <StatCard label="Cash" value={totalCash} color="#3b82f6" />
          <StatCard label="Investments" value={totalInvest} color="#8b5cf6" />
        </div>
      </div>

      {/* ═══ SAVINGS ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-5 rounded-full bg-emerald-400" />
            Savings
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Savings Rate</span>
            <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
              {(['weekly', 'monthly'] as const).map((v) => (
                <button key={v} onClick={() => { setCfView(v); setCfSelection(null) }}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${cfView === v ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {v === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-7 relative select-none">
            <ChartLabel>{cfView === 'weekly' ? 'By Week (Last 12 Weeks)' : 'By Month (Last 6 Months)'}</ChartLabel>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
              <ComposedChart data={cfComparisonData} onMouseDown={handleCfMouseDown} onMouseMove={handleCfMouseMove} onMouseUp={handleCfMouseUp}>
                <XAxis dataKey="label" {...ax} interval={0} />
                <YAxis {...ax} tickFormatter={(v: number) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  cursor={{ fill: '#6366f120' }}
                  wrapperStyle={{ zIndex: 50 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const inflow = payload.find((p) => p.dataKey === 'inflow')?.value as number || 0
                    const outflow = payload.find((p) => p.dataKey === 'outflow')?.value as number || 0
                    const net = inflow - outflow
                    return (
                      <div style={{ ...tt, zIndex: 50 }} className="p-3 rounded-xl shadow-xl">
                        <p className="text-xs text-gray-400 mb-2 font-medium">{label}</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-6 text-xs">
                            <span className="text-emerald-400">Income</span>
                            <span className="text-emerald-400 font-semibold">{formatCurrency(inflow)}</span>
                          </div>
                          <div className="flex justify-between gap-6 text-xs">
                            <span className="text-rose-400">Expenses</span>
                            <span className="text-rose-400 font-semibold">{formatCurrency(outflow)}</span>
                          </div>
                          <div className="border-t border-[#2a2d3d] pt-1.5 flex justify-between gap-6 text-xs">
                            <span className={net >= 0 ? 'text-emerald-300' : 'text-rose-400'}>Savings</span>
                            <span className={`font-bold ${net >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                              {net >= 0 ? '+' : ''}{formatCurrency(net)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={chartLegendStyle} />
                <Bar dataKey="inflow" fill="#10b981" opacity={0.6} radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="outflow" fill="#f43f5e" opacity={0.6} radius={[4, 4, 0, 0]} name="Expenses" />
                <Bar dataKey="netPositive" fill="#34d399" opacity={0.9} radius={[4, 4, 0, 0]} name="Savings" />
                <Line type="monotone" dataKey="netPositive" stroke="#6ee7b7" strokeWidth={3} dot={{ r: 3, fill: '#6ee7b7' }} connectNulls={false} name="Savings Trend" />
                {cfDragStart && cfDragEnd && (
                  <ReferenceArea x1={cfDragStart} x2={cfDragEnd} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.15} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            {cfSelection && (
              <div className="absolute top-10 right-4 bg-[#252839] border border-[#2a2d3d] rounded-xl p-3 shadow-xl z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{cfSelection.startLabel} to {cfSelection.endLabel}</p>
                  <button onClick={() => setCfSelection(null)} className="text-gray-500 hover:text-gray-300 text-xs ml-3">x</button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-emerald-400">Income</span>
                    <span className={`font-semibold ${cfSelection.inflowDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {cfSelection.inflowDiff >= 0 ? '+' : ''}{formatCurrency(cfSelection.inflowDiff)} ({cfSelection.inflowPct >= 0 ? '+' : ''}{cfSelection.inflowPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-rose-400">Expenses</span>
                    <span className={`font-semibold ${cfSelection.outflowDiff >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {cfSelection.outflowDiff >= 0 ? '+' : ''}{formatCurrency(cfSelection.outflowDiff)} ({cfSelection.outflowPct >= 0 ? '+' : ''}{cfSelection.outflowPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="col-span-5 space-y-4">
            <div className={`rounded-2xl p-5 border ${heroSavings >= 0 ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-400/30' : 'bg-gradient-to-br from-rose-500/15 to-rose-600/5 border-rose-500/20'}`}>
              <p className={`text-[10px] uppercase tracking-wider font-medium ${heroSavings >= 0 ? 'text-emerald-300/80' : 'text-rose-400/70'}`}>
                {cfView === 'weekly' ? 'Last Week' : 'Last Month'}
              </p>
              <div className="flex items-end justify-between mt-1">
                <div>
                  <p className={`text-3xl font-bold ${heroSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {heroSavings >= 0 ? '+' : ''}{formatCurrency(heroSavings)}
                  </p>
                </div>
                <div className="text-right">
                  {/* Savings rate — cap display at reasonable range */}
                  <p className={`text-lg font-bold ${heroSavingsRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Math.abs(heroSavingsRate) > 999 ? (heroSavingsRate > 0 ? '>100%' : 'Deficit') : `${heroSavingsRate.toFixed(0)}%`}
                  </p>
                  <p className="text-[10px] text-gray-500">savings rate</p>
                </div>
              </div>
              {/* Comparison to average */}
              {cfComparisonData.length > 1 && (() => {
                const avgNet = cfComparisonData.reduce((s, d) => s + d.net, 0) / cfComparisonData.length
                const diff = heroSavings - avgNet
                const isAbove = diff >= 0
                return (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2a2d3d]/50">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${isAbove ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isAbove ? '↑' : '↓'} {formatCurrency(Math.abs(diff))}
                      </span>
                      <span className="text-[10px] text-gray-500">{isAbove ? 'above' : 'below'} avg</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">Avg: </span>
                      <span className={`text-xs font-medium ${avgNet >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                        {formatCurrency(avgNet)}/{cfView === 'weekly' ? 'wk' : 'mo'}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            <BreakdownList title="Income" items={inflowBreakdown} total={cfTotalIncome} positive />
            <BreakdownList title="Expenses" items={outflowBreakdown} total={cfTotalExpenses} positive={false} />
          </div>
        </div>
      </div>

      {/* ═══ SPENDING ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-indigo-500" />
            Spending
          </h2>
          <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
            {(['weekly', 'monthly'] as const).map((v) => (
              <button key={v} onClick={() => setSpendingPeriod(v)}
                className={`px-3 py-1 text-xs rounded-md transition-all ${spendingPeriod === v ? 'bg-[#6366f1] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {/* Spending over time */}
          <Card className="min-w-0 flex-1 transition-all duration-500 ease-out">
            <div className="flex items-center justify-between mb-1">
              <ChartLabel>Spending Over Time</ChartLabel>
              <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
                {([['overall', 'Overall'], ['account', 'By Account'], ['category', 'By Category']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setSpendingView(key)}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${spendingView === key ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
              <AreaChart data={spendingView === 'overall' ? spendingBuckets : spendingView === 'account' ? spendingByAccountBuckets : spendingByCategoryBuckets}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  {spendingView === 'account' && spendingAccountKeys.map((a) => (
                    <linearGradient key={`sg-${a.key}`} id={`spendGrad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={a.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={a.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                  {spendingView === 'category' && spendingCategoryKeys.map((c) => (
                    <linearGradient key={`sg-${c.key}`} id={`spendGrad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="label" {...ax} />
                <YAxis {...ax} tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                {spendingView === 'overall' && (
                  <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" name="Spending" />
                )}
                {spendingView === 'account' && spendingAccountKeys.map((a) => (
                  <Area key={a.key} type="monotone" dataKey={a.key} stroke={a.color} strokeWidth={2} fill={`url(#spendGrad-${a.key})`} name={a.name} />
                ))}
                {spendingView === 'category' && spendingCategoryKeys.map((c) => (
                  <Area key={c.key} type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} fill={`url(#spendGrad-${c.key})`} name={c.name} />
                ))}
                {spendingView !== 'overall' && (
                  <Legend wrapperStyle={chartLegendStyle} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Donut — slides in/out */}
          <div className="transition-all duration-500 ease-out overflow-hidden" style={{ width: spendingView === 'overall' ? 0 : 380, minWidth: spendingView === 'overall' ? 0 : 380, opacity: spendingView === 'overall' ? 0 : 1 }}>
            {spendingView !== 'overall' && (
            <Card className="h-full">
              <ChartLabel>{spendingView === 'category' ? 'By Category' : 'By Account'}</ChartLabel>
              {spendingView === 'category' ? (
                <DonutChart data={spendingCategories} height={CHART_HEIGHT.large} colorMode="category" emptyMessage="No spending data" />
              ) : (
                <DonutChart
                  data={spendingAccountKeys.map((a) => {
                    const total = spendingFilteredTxns.filter((t) => t.account_id === a.key).reduce((s, t) => s + t.amount, 0)
                    return { name: a.name, value: Math.round(total * 100) / 100, color: a.color }
                  }).filter((d) => d.value > 0)}
                  height={CHART_HEIGHT.large}
                  colorMode="custom"
                  emptyMessage="No account data"
                />
              )}
            </Card>
          )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Top merchants */}
          <Card>
            <ChartLabel>Top Merchants</ChartLabel>
            {topMerchants.length > 0 ? (
              <div className="space-y-3">
                {topMerchants.map((m, i) => (
                  <MerchantBar key={m.name} name={m.name} value={m.value} maxValue={topMerchants[0]?.value || 1} color={CHART_COLORS[i % CHART_COLORS.length]} index={i} />
                ))}
              </div>
            ) : <p className="text-gray-600 text-sm py-16 text-center">No data</p>}
          </Card>

          {/* Recent transactions + Safe to spend */}
          <Card className="col-span-2">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <ChartLabel>Recent Transactions</ChartLabel>
                <div className="space-y-2">
                  {spendingFilteredTxns.slice(0, 8).map((t) => (
                    <TransactionRow key={t.id} date={t.date} merchantName={t.merchant_name} name={t.name} category={t.category} amount={t.amount} compact />
                  ))}
                  {spendingFilteredTxns.length === 0 && <p className="text-gray-600 text-sm py-4">No transactions in this period.</p>}
                </div>
              </div>
              <div>
                <ChartLabel>Safe to Spend</ChartLabel>
                <p className="text-3xl font-bold text-white">{formatCurrency(safeToSpend.safeToSpendToday)}</p>
                <p className="text-xs text-gray-500 mt-1">today</p>
                <div className="flex gap-4 text-xs text-gray-400 mt-2">
                  <span>Week: <span className="text-gray-300">{formatCurrency(safeToSpend.safeToSpendThisWeek)}</span></span>
                  <span>Month: <span className="text-gray-300">{formatCurrency(safeToSpend.safeToSpendThisMonth)}</span></span>
                </div>
                <div className="mt-3">
                  <ResponsiveContainer width="100%" height={70}>
                    <LineChart data={forecast.timeline.slice(0, 14)}>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                      <ReferenceLine y={0} stroke="#ef444450" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="projectedBalance" stroke={forecast.riskOfNegative ? '#ef4444' : '#10b981'} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ INVESTMENTS ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-purple-500" />
            Investments
            <span className="text-sm font-normal text-purple-400 ml-2">{formatCurrency(totalInvest)}</span>
          </h2>
        </div>

        {investAccounts.length === 0 ? (
          <Card><p className="text-gray-600 text-sm py-12 text-center">No investment accounts linked</p></Card>
        ) : (<>
        <div className="flex gap-4 overflow-hidden">
          {/* Portfolio value line chart — expands when Overall */}
          <Card className="min-w-0 flex-1 transition-all duration-500 ease-out">
            <div className="flex items-center justify-between mb-1">
              <ChartLabel>Portfolio Value</ChartLabel>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
                  {([['overall', 'Overall'], ['account', 'By Account'], ['holding', 'By Holding']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setInvestView(key)}
                      className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${investView === key ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
                  {([['7', '1W'], ['30', '1M'], ['180', '6M'], ['365', '1Y']] as const).map(([days, label]) => (
                    <button key={days} onClick={() => setInvestRange(Number(days))}
                      className={`px-2 py-1 text-[10px] rounded-md transition-all ${investRange === Number(days) ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-3">
              <span className="text-2xl font-bold text-purple-400">{formatCurrency(totalInvest)}</span>
              <span className="text-xs text-gray-500 ml-2">{investAccounts.length} account{investAccounts.length > 1 ? 's' : ''}</span>
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
              <AreaChart data={investChartData}>
                <defs>
                  {investView === 'overall' ? (
                    <linearGradient id="investGradAll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  ) : investLineKeys.map((k) => (
                    <linearGradient key={`ig-${k.key}`} id={`investGrad-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={k.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="label" {...ax} interval={Math.max(0, Math.floor(investChartData.length / 7))} />
                <YAxis {...ax} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                {investView !== 'overall' && <Legend wrapperStyle={chartLegendStyle} />}
                {investView === 'overall' ? (
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#investGradAll)" name="Portfolio" />
                ) : investLineKeys.map((k) => (
                  <Area key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2} fill={`url(#investGrad-${k.key})`} name={k.name} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            {portfolioSyncing && <p className="text-[10px] text-purple-400 text-center mt-1 animate-pulse">Loading investment history...</p>}
          </Card>

          {/* Donut — slides in when not Overall */}
          <div className="transition-all duration-500 ease-out overflow-hidden" style={{ width: investView === 'overall' ? 0 : 380, minWidth: investView === 'overall' ? 0 : 380, opacity: investView === 'overall' ? 0 : 1 }}>
            {investView !== 'overall' && (
            <Card className="h-full">
              <ChartLabel>{investView === 'account' ? 'By Account' : 'By Holding'}</ChartLabel>
              {investView === 'account' ? (
                <DonutChart
                  data={investAccounts.map((a, i) => ({ name: a.name.replace('Plaid ', ''), value: a.current_balance ?? 0, color: CHART_COLORS[i % CHART_COLORS.length] }))}
                  height={CHART_HEIGHT.large} colorMode="custom" emptyMessage="No accounts"
                />
              ) : (
                <DonutChart
                  data={portfolio.topHoldings.length > 0
                    ? portfolio.topHoldings.map((h) => ({ name: h.tickerSymbol || h.securityName, value: h.currentValue }))
                    : portfolio.allocationByClass.map((a) => ({ name: a.assetClass, value: a.value }))}
                  height={CHART_HEIGHT.large} colorMode="palette" emptyMessage="No holdings data"
                />
              )}
            </Card>
            )}
          </div>
        </div>

        {/* Performance row below */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Card>
            <ChartLabel>Performance</ChartLabel>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Value</span>
                <span className="text-white font-semibold">{formatCurrency(portfolio.totalValue > 0 ? portfolio.totalValue : totalInvest)}</span>
              </div>
              {portfolio.totalGainLoss != null && portfolio.totalGainLoss !== 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Gain / Loss</span>
                  <span className={`font-semibold ${portfolio.totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {portfolio.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolio.totalGainLoss)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Accounts</span>
                <span className="text-gray-300">{investAccounts.length}</span>
              </div>
            </div>
          </Card>
          <Card className="col-span-2">
            <ChartLabel>Holdings</ChartLabel>
            <div className="space-y-2">
              {(portfolio.topHoldings.length > 0 ? portfolio.topHoldings.slice(0, 5) : []).map((h, i) => (
                <div key={h.securityName} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-300">{h.tickerSymbol || h.securityName}</span>
                    {h.gainLossPercent != null && (
                      <span className={`${h.gainLossPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.gainLossPercent >= 0 ? '+' : ''}{h.gainLossPercent}%
                      </span>
                    )}
                  </div>
                  <span className="text-gray-200 font-medium">{formatCurrency(h.currentValue)}</span>
                </div>
              ))}
              {portfolio.topHoldings.length === 0 && investAccounts.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-300">{a.name.replace('Plaid ', '')}</span>
                  </div>
                  <span className="text-gray-200 font-medium">{formatCurrency(a.current_balance ?? 0)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </>)}
      </div>

      {/* ═══ CASH & SAVINGS ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-blue-500" />
            Cash &amp; Savings
            <span className="text-sm font-normal text-blue-400 ml-2">{formatCurrency(totalCash)}</span>
          </h2>
        </div>

        <div className="flex gap-4 overflow-hidden">
          <Card className="min-w-0 flex-1 transition-all duration-500 ease-out">
            <div className="flex items-center justify-between mb-1">
              <ChartLabel>Cash Balance</ChartLabel>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
                  {([['overall', 'Overall'], ['account', 'By Account']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setCashView(key)}
                      className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${cashView === key ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
                  {([['30', '1M'], ['90', '3M'], ['180', '6M'], ['365', '1Y']] as const).map(([days, label]) => (
                    <button key={days} onClick={() => setCashRange(Number(days))}
                      className={`px-2 py-1 text-[10px] rounded-md transition-all ${cashRange === Number(days) ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-3">
              <span className="text-2xl font-bold text-blue-400">{formatCurrency(totalCash)}</span>
              <span className="text-xs text-gray-500 ml-2">{accounts.filter((a) => a.type === 'depository').length} accounts</span>
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
              <AreaChart data={cashChartData}>
                <defs>
                  {cashView === 'overall' ? (
                    <linearGradient id="cashGradAll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  ) : cashLineKeys.map((k) => (
                    <linearGradient key={`cg-${k.key}`} id={`cashGrad-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={k.color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="label" {...ax} interval={Math.max(0, Math.floor(cashChartData.length / 7))} />
                <YAxis {...ax} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                {cashView !== 'overall' && <Legend wrapperStyle={chartLegendStyle} />}
                {cashView === 'overall' ? (
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#cashGradAll)" name="Cash" />
                ) : cashLineKeys.map((k) => (
                  <Area key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={2} fill={`url(#cashGrad-${k.key})`} name={k.name} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            {cashSyncing && <p className="text-[10px] text-blue-400 text-center mt-1 animate-pulse">Loading cash history...</p>}
          </Card>

          {/* Forecast — always visible on right */}
          <div style={{ width: 380, minWidth: 380 }}>
            <Card className="h-full">
              <ChartLabel>30-Day Forecast</ChartLabel>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT.medium}>
                <AreaChart data={forecast.timeline}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={forecast.riskOfNegative ? '#ef4444' : '#10b981'} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={forecast.riskOfNegative ? '#ef4444' : '#10b981'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" {...ax} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} interval={6} />
                  <YAxis {...ax} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
                  <ReferenceLine y={0} stroke="#ef444440" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="projectedBalance" stroke={forecast.riskOfNegative ? '#ef4444' : '#10b981'} strokeWidth={2} fill="url(#forecastGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              {forecast.riskOfNegative && (
                <p className="text-xs text-rose-400 mt-1">Balance may go negative in {forecast.daysUntilNegative} days</p>
              )}
              <div className="mt-3 pt-3 border-t border-[#2a2d3d] space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Safe to spend today</span>
                  <span className="text-white font-semibold">{formatCurrency(safeToSpend.safeToSpendToday)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">This week</span>
                  <span className="text-gray-300">{formatCurrency(safeToSpend.safeToSpendThisWeek)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">This month</span>
                  <span className="text-gray-300">{formatCurrency(safeToSpend.safeToSpendThisMonth)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
