import { useMemo, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceArea,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAccounts } from '../hooks/useAccounts'
import { useNetWorth } from '../hooks/useNetWorth'
import { useTransactions } from '../hooks/useTransactions'
import { useInvestments } from '../hooks/useInvestments'
// Goals removed
import { usePortfolioHistory } from '../hooks/usePortfolioHistory'
import { useCashHistory } from '../hooks/useCashHistory'
import { computeNetWorth } from '../lib/engines/net-worth'
import { computeCashOptimization } from '../lib/engines/cash-optimization'
import { computeInvestmentPortfolio } from '../lib/engines/investment-portfolio'
// Goal tracking removed
import { formatCurrency, currentMonthKey, CHART_COLORS, addDays, todayStr } from '../lib/engines/utils'
import { usePrivacy } from '../hooks/usePrivacy'
import {
  Card, ChartLabel, DonutChart, chartTooltipStyle as tt, chartAxisProps as ax,
  chartLegendStyle, CHART_HEIGHT,
} from '../components/ui'

const RANGE_OPTIONS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
]

// Budgets & Goals removed from this page

export function Wealth() {
  const { mask: pm, toggle: privacyToggle, revealed: privacyRevealed } = usePrivacy()
  const [rangeDays, setRangeDays] = useState(90)
  const [nwView, setNwView] = useState<'overall' | 'inout'>('overall')

  // Drag state (handlers defined after nwChartData)
  const [nwDragStart, setNwDragStart] = useState<string | null>(null)
  const [nwDragEnd, setNwDragEnd] = useState<string | null>(null)
  const [nwSelection, setNwSelection] = useState<{ startLabel: string; endLabel: string; startVal: number; endVal: number; diff: number; pct: number } | null>(null)

  const { accounts } = useAccounts()
  const { snapshots } = useNetWorth(rangeDays)
  const { transactions } = useTransactions({ months: Math.ceil(rangeDays / 30) })
  const { holdings } = useInvestments()
  // Goals removed
  const { timeline: portfolioTimeline, byAccount: portfolioByAccount } = usePortfolioHistory({ days: rangeDays })
  const { timeline: cashTimeline, byAccount: cashByAccount } = useCashHistory({ days: rangeDays })

  const monthKey = currentMonthKey()
  const monthlyExpenses = useMemo(
    () => transactions.filter((t) => t.date.startsWith(monthKey) && t.amount > 0).reduce((s, t) => s + t.amount, 0),
    [transactions, monthKey]
  )

  const nw = useMemo(() => computeNetWorth(accounts, snapshots), [accounts, snapshots])
  const cashOpt = useMemo(() => computeCashOptimization(accounts, monthlyExpenses), [accounts, monthlyExpenses])
  const portfolio = useMemo(() => computeInvestmentPortfolio(holdings), [holdings])
  // Goals removed

  const totalCash = accounts.filter((a) => a.type === 'depository').reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalInvest = accounts.filter((a) => a.type === 'investment').reduce((s, a) => s + (a.current_balance ?? 0), 0)

  // Net worth chart data — combine cash + investment timelines
  const nwChartData = useMemo(() => {
    const fmtLabel = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (nwView === 'overall') {
      // Use net_worth_snapshots (same source as Dashboard) + append today's live value
      const todayStrNow = new Date().toISOString().split('T')[0]
      const historical = snapshots
        .filter((s) => s.snapshot_date !== todayStrNow)
        .map((s) => ({ label: fmtLabel(s.snapshot_date), value: s.net_worth }))
      const liveToday = { label: 'Today', value: nw.netWorth }
      return [...historical, liveToday]
    }

    // Money in / money out view — from transactions
    const today = todayStr()
    const start = addDays(today, -rangeDays)
    const filtered = transactions.filter((t) => t.date >= start)
    // Group by week or month depending on range
    const groupByMonth = rangeDays > 60
    const map = new Map<string, { inflow: number; outflow: number }>()
    for (const t of filtered) {
      const key = groupByMonth ? t.date.substring(0, 7) : t.date.substring(0, 10)
      if (!map.has(key)) map.set(key, { inflow: 0, outflow: 0 })
      const e = map.get(key)!
      if (t.amount < 0) e.inflow += Math.abs(t.amount); else e.outflow += t.amount
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({
      label: groupByMonth ? new Date(key + '-01').toLocaleDateString('en-US', { month: 'short' }) : fmtLabel(key),
      inflow: Math.round(v.inflow),
      outflow: Math.round(v.outflow),
    }))
  }, [nwView, snapshots, transactions, rangeDays, nw.netWorth])

  // Drag handlers (after nwChartData is defined)
  const handleNwMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e?.activeLabel) { setNwDragStart(e.activeLabel); setNwDragEnd(null); setNwSelection(null) }
  }, [])
  const handleNwMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (nwDragStart && e?.activeLabel) setNwDragEnd(e.activeLabel)
  }, [nwDragStart])
  const handleNwMouseUp = useCallback(() => {
    if (nwDragStart && nwDragEnd && nwDragStart !== nwDragEnd) {
      const labels = nwChartData.map((d: any) => d.label)
      const si = labels.indexOf(nwDragStart)
      const ei = labels.indexOf(nwDragEnd)
      if (si >= 0 && ei >= 0) {
        const [startIdx, endIdx] = si < ei ? [si, ei] : [ei, si]
        const startVal = (nwChartData[startIdx] as any).value ?? 0
        const endVal = (nwChartData[endIdx] as any).value ?? 0
        const diff = endVal - startVal
        const pct = startVal !== 0 ? (diff / Math.abs(startVal)) * 100 : 0
        setNwSelection({ startLabel: labels[startIdx], endLabel: labels[endIdx], startVal, endVal, diff, pct })
      }
    }
    setNwDragStart(null)
    setNwDragEnd(null)
  }, [nwDragStart, nwDragEnd, nwChartData])

  // Assets by account for donut
  const assetAccounts = useMemo(() =>
    accounts
      .filter((a) => (a.type === 'depository' || a.type === 'investment') && (a.current_balance ?? 0) > 0)
      .map((a) => ({ name: a.name.replace('Plaid ', ''), value: a.current_balance ?? 0, type: a.type }))
      .sort((a, b) => b.value - a.value),
    [accounts]
  )
  const totalAssets = assetAccounts.reduce((s, a) => s + a.value, 0)

  // Known money market fund tickers held inside investment accounts
  const MONEY_MARKET_TICKERS = new Set(['SPAXX', 'SWVXX', 'FDRXX', 'FCASH', 'VMFXX', 'SPRXX'])

  // Asset type distribution (Cash, Stocks, Retirement, IRA, MMF, etc.)
  const assetTypeDistribution = useMemo(() => {
    const items: { name: string; value: number; color: string }[] = []
    let cashTotal = 0, retirementTotal = 0, iraTotal = 0, brokerageTotal = 0, mmfTotal = 0, hsaTotal = 0, otherTotal = 0

    // Pre-compute money-market value per investment account from holdings
    const mmfByAccount = new Map<string, number>()
    for (const h of holdings) {
      const isMM =
        h.asset_class === 'cash' ||
        MONEY_MARKET_TICKERS.has((h.ticker_symbol || '').toUpperCase())
      if (isMM && h.current_value > 0) {
        mmfByAccount.set(h.account_id, (mmfByAccount.get(h.account_id) || 0) + h.current_value)
      }
    }

    for (const a of accounts) {
      if ((a.current_balance ?? 0) <= 0) continue
      const bal = a.current_balance ?? 0
      const sub = a.subtype?.toLowerCase() || ''
      const name = a.name.toLowerCase()

      if (a.type === 'depository') {
        if (sub === 'money market' || name.includes('money market') || name.includes('mmf')) mmfTotal += bal
        else if (sub === 'hsa' || name.includes('hsa')) hsaTotal += bal
        else cashTotal += bal
      } else if (a.type === 'investment') {
        // Separate money-market holdings from this investment account
        const mmfInAccount = mmfByAccount.get(a.id) || 0
        const nonMmfBal = Math.max(0, bal - mmfInAccount)

        if (sub === '401k' || sub === '401a' || name.includes('401k') || name.includes('401(k)')) {
          retirementTotal += nonMmfBal
        } else if (sub === 'ira' || sub === 'roth' || name.includes('ira') || name.includes('roth')) {
          iraTotal += nonMmfBal
        } else {
          brokerageTotal += nonMmfBal
        }
        mmfTotal += mmfInAccount
      }
    }

    if (cashTotal > 0) items.push({ name: 'Cash (Checking/Savings)', value: Math.round(cashTotal), color: '#3b82f6' })
    if (mmfTotal > 0) items.push({ name: 'Money Market / HYSA', value: Math.round(mmfTotal), color: '#06b6d4' })
    if (hsaTotal > 0) items.push({ name: 'HSA', value: Math.round(hsaTotal), color: '#14b8a6' })
    if (retirementTotal > 0) items.push({ name: '401(k) / Retirement', value: Math.round(retirementTotal), color: '#8b5cf6' })
    if (iraTotal > 0) items.push({ name: 'IRA / Roth', value: Math.round(iraTotal), color: '#a78bfa' })
    if (brokerageTotal > 0) items.push({ name: 'Stocks / Brokerage', value: Math.round(brokerageTotal), color: '#f59e0b' })
    if (otherTotal > 0) items.push({ name: 'Other', value: Math.round(otherTotal), color: '#6b7280' })
    return items.sort((a, b) => b.value - a.value)
  }, [accounts, holdings])

  // Liabilities
  // Warm palette for liabilities — reds/pinks for credit, ambers/oranges for loans
  const LIABILITY_COLORS_CREDIT = ['#f43f5e', '#8b5cf6', '#3b82f6', '#ec4899', '#06b6d4']
  const LIABILITY_COLORS_LOAN = ['#f59e0b', '#f97316', '#d97706', '#ea580c', '#b45309']

  const liabilityAccounts = useMemo(() => {
    const items = accounts
      .filter((a) => (a.type === 'credit' || a.type === 'loan') && (a.current_balance ?? 0) > 0)
      .map((a) => ({ name: a.name.replace('Plaid ', ''), value: a.current_balance ?? 0, type: a.type, color: '' }))
      .sort((a, b) => b.value - a.value)
    // Assign unique colors per type
    let ci = 0, li = 0
    for (const item of items) {
      if (item.type === 'credit') { item.color = LIABILITY_COLORS_CREDIT[ci % LIABILITY_COLORS_CREDIT.length]; ci++ }
      else { item.color = LIABILITY_COLORS_LOAN[li % LIABILITY_COLORS_LOAN.length]; li++ }
    }
    return items
  }, [accounts])
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.value, 0)

  const allInsights = [...nw.insights, ...cashOpt.insights].slice(0, 3)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Wealth</h1>
        <button onClick={privacyToggle} className="text-gray-600 hover:text-gray-400 transition-colors" title={privacyRevealed ? 'Hide amounts' : 'Show amounts'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {privacyRevealed ? (
              <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
            ) : (
              <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
            )}
          </svg>
        </button>
      </div>

      {/* Net Worth Hero */}
      <div className="bg-gradient-to-r from-[#10b981]/15 to-[#06b6d4]/10 border border-[#10b981]/20 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Net Worth */}
          <div className="min-w-0">
            <p className="text-sm text-gray-400">Net worth</p>
            <p className="text-2xl sm:text-4xl font-bold text-white mt-1 tabular-nums">{pm(formatCurrency(nw.netWorth))}</p>
            <span className={`text-sm font-medium tabular-nums ${nw.monthlyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {nw.monthlyChange >= 0 ? '+' : ''}{pm(formatCurrency(nw.monthlyChange))}
              {nw.monthlyChangePercent !== 0 && ` (${nw.monthlyChangePercent > 0 ? '+' : ''}${nw.monthlyChangePercent}%)`}
              {' '}this month
            </span>
          </div>

          {/* Mobile: stacked rows. Desktop: side-by-side Assets/Liabilities. */}
          <div className="sm:hidden space-y-1 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Assets</span>
              <span className="text-sm font-semibold text-emerald-400 tabular-nums">{pm(formatCurrency(nw.totalAssets))}</span>
            </div>
            <div className="flex items-center justify-between pl-3">
              <span className="text-[10px] text-gray-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Cash</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{pm(formatCurrency(nw.cashBalance))}</span>
            </div>
            <div className="flex items-center justify-between pl-3">
              <span className="text-[10px] text-gray-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" />Invest</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{pm(formatCurrency(nw.investmentBalance))}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-500">Liabilities</span>
              <span className="text-sm font-semibold text-rose-400 tabular-nums">{pm(formatCurrency(nw.totalLiabilities))}</span>
            </div>
            <div className="flex items-center justify-between pl-3">
              <span className="text-[10px] text-gray-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" />Credit</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{pm(formatCurrency(nw.creditBalance))}</span>
            </div>
            <div className="flex items-center justify-between pl-3">
              <span className="text-[10px] text-gray-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Loans</span>
              <span className="text-[11px] text-gray-400 tabular-nums">{pm(formatCurrency(nw.loanBalance))}</span>
            </div>
          </div>

          {/* Desktop: Assets & Liabilities side-by-side */}
          <div className="hidden sm:flex gap-6">
            <div className="sm:text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Assets</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{pm(formatCurrency(nw.totalAssets))}</p>
              <div className="flex items-center gap-2 mt-1 justify-end">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-gray-500 tabular-nums">Cash {pm(formatCurrency(nw.cashBalance))}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-[10px] text-gray-500 tabular-nums">Invest {pm(formatCurrency(nw.investmentBalance))}</span>
                </div>
              </div>
            </div>
            <div className="w-px bg-[#2a2d3d]" />
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Liabilities</p>
              <p className="text-2xl font-bold text-rose-400 mt-1 tabular-nums">{pm(formatCurrency(nw.totalLiabilities))}</p>
              <div className="flex items-center gap-2 mt-1 justify-end">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] text-gray-500 tabular-nums">Credit {pm(formatCurrency(nw.creditBalance))}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-gray-500 tabular-nums">Loans {pm(formatCurrency(nw.loanBalance))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ NET WORTH OVER TIME ═══ */}
      <Card className="relative select-none">
        <div className="flex items-center justify-between mb-1">
          <ChartLabel>Net Worth Over Time</ChartLabel>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
              {([['overall', 'Overall'], ['inout', 'Money In & Out']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setNwView(key)}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${nwView === key ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
              {RANGE_OPTIONS.map((opt) => (
                <button key={opt.days} onClick={() => setRangeDays(opt.days)}
                  className={`px-2 py-1 text-[10px] rounded-md transition-all ${rangeDays === opt.days ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
          {nwView === 'overall' ? (
            <AreaChart data={nwChartData} onMouseDown={handleNwMouseDown} onMouseMove={handleNwMouseMove} onMouseUp={handleNwMouseUp}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...ax} interval={Math.max(0, Math.floor(nwChartData.length / 8))} />
              <YAxis {...ax} domain={[(dataMin: number) => Math.floor(dataMin * 0.98), (dataMax: number) => Math.ceil(dataMax * 1.02)]} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#nwGrad)" name="Net Worth" />
              {nwDragStart && nwDragEnd && (
                <ReferenceArea x1={nwDragStart} x2={nwDragEnd} strokeOpacity={0.3} fill="#10b981" fillOpacity={0.1} />
              )}
            </AreaChart>
          ) : (
            <BarChart data={nwChartData} barGap={4} maxBarSize={40}>
              <XAxis dataKey="label" {...ax} interval={0} />
              <YAxis {...ax} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip cursor={{ fill: '#10b98110' }} formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
              <Legend wrapperStyle={chartLegendStyle} />
              <Bar dataKey="inflow" fill="#10b981" opacity={0.8} radius={[4, 4, 0, 0]} name="Money In" />
              <Bar dataKey="outflow" fill="#f43f5e" opacity={0.8} radius={[4, 4, 0, 0]} name="Money Out" />
            </BarChart>
          )}
        </ResponsiveContainer>
        {nwSelection && (
          <div className="absolute top-12 right-5 bg-[#252839] border border-[#2a2d3d] rounded-xl p-3 shadow-xl z-10">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{nwSelection.startLabel} → {nwSelection.endLabel}</p>
              <button onClick={() => setNwSelection(null)} className="text-gray-500 hover:text-gray-300 text-xs ml-3">✕</button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between gap-6 text-xs">
                <span className="text-gray-500">Start</span>
                <span className="text-gray-300">{pm(formatCurrency(nwSelection.startVal))}</span>
              </div>
              <div className="flex justify-between gap-6 text-xs">
                <span className="text-gray-500">End</span>
                <span className="text-gray-300">{pm(formatCurrency(nwSelection.endVal))}</span>
              </div>
              <div className="border-t border-[#2a2d3d] pt-1.5 flex justify-between gap-6 text-xs">
                <span className={nwSelection.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>Change</span>
                <span className={`font-bold ${nwSelection.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {nwSelection.diff >= 0 ? '+' : ''}{pm(formatCurrency(nwSelection.diff))} ({nwSelection.pct >= 0 ? '+' : ''}{nwSelection.pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ═══ ASSETS — Distribution by Account (donut + list) ═══ */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-blue-500" />
          Assets
          <span className="text-sm font-normal text-emerald-400 ml-2">{pm(formatCurrency(totalAssets))}</span>
        </h2>
        <Card>
          <ChartLabel>Distribution by Account</ChartLabel>
          <DonutChart
            data={assetAccounts.map((a, i) => ({ name: a.name, value: a.value, color: CHART_COLORS[i % CHART_COLORS.length] }))}
            height={CHART_HEIGHT.medium} colorMode="custom" emptyMessage="No assets"
          />
        </Card>
      </div>

      {/* ═══ ASSET TYPE — Stacked bar + tiles (different layout) ═══ */}
      <Card>
        <ChartLabel>Asset Type Breakdown</ChartLabel>
        {/* Stacked proportion bar */}
        <div className="flex h-8 rounded-xl overflow-hidden mb-4">
          {assetTypeDistribution.map((item) => {
            const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
            return pct > 0 ? (
              <div
                key={item.name}
                className="h-full relative group transition-all hover:opacity-80"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
                title={`${item.name}: ${pm(formatCurrency(item.value))} (${pct.toFixed(1)}%)`}
              />
            ) : null
          })}
        </div>
        {/* Tile grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assetTypeDistribution.map((item) => {
            const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
            return (
              <div key={item.name} className="bg-[#252839] rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}20` }}>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 truncate">{item.name}</p>
                  <p className="text-sm font-semibold text-white">{pm(formatCurrency(item.value))}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ═══ LIABILITIES — Individual account cards (different layout) ═══ */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-rose-500" />
          Liabilities
          <span className="text-sm font-normal text-rose-400 ml-2">{pm(formatCurrency(totalLiabilities))}</span>
        </h2>
        {liabilityAccounts.length === 0 ? (
          <Card><p className="text-gray-600 text-sm py-8 text-center">No liabilities</p></Card>
        ) : (<>
          {/* Total — prominent hero */}
          <div className="bg-gradient-to-r from-rose-500/15 to-amber-500/10 border border-rose-500/20 rounded-2xl p-4 sm:p-6 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-400">Total Outstanding</p>
                <p className="text-4xl font-bold text-rose-400 mt-1">{pm(formatCurrency(totalLiabilities))}</p>
                <p className="text-xs text-gray-500 mt-1">{liabilityAccounts.length} accounts · {liabilityAccounts.filter((a) => a.type === 'credit').length} credit cards · {liabilityAccounts.filter((a) => a.type === 'loan').length} loans</p>
              </div>
              {/* Stacked bar with per-account colors */}
              <div className="w-56">
                <div className="flex h-4 rounded-full overflow-hidden">
                  {liabilityAccounts.map((a, i) => {
                    const pct = totalLiabilities > 0 ? (a.value / totalLiabilities) * 100 : 0
                    return <div key={i} className="h-full" style={{ width: `${pct}%`, backgroundColor: a.color }} title={`${a.name}: ${pct.toFixed(0)}%`} />
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {liabilityAccounts.map((a, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                      <span className="text-[10px] text-gray-500 truncate max-w-[80px]">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Individual account cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liabilityAccounts.map((a, i) => {
              const pct = totalLiabilities > 0 ? (a.value / totalLiabilities) * 100 : 0
              return (
                <div key={i} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: a.color, transform: 'translate(30%, -30%)' }} />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      {a.type === 'credit' ? 'Credit Card' : 'Loan'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">{a.name}</p>
                  <p className="text-2xl font-bold" style={{ color: a.color }}>{pm(formatCurrency(a.value))}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-[#252839] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: a.color }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>)}
      </div>

      {/* Goals section removed */}
    </div>
  )
}
