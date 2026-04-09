import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategoryOverrides } from '../hooks/useCategoryOverrides'
import { formatCurrency, getCategoryColor, formatCategoryName, CHART_COLORS, addDays, todayStr, CATEGORY_COLORS } from '../lib/engines/utils'
import {
  Card, ChartLabel, StatCard, TransactionRow, DonutChart, MerchantBar, TruncatedText,
  chartTooltipStyle as tt, chartAxisProps as ax, chartLegendStyle, CHART_HEIGHT,
} from '../components/ui'

// All available Plaid categories for the dropdown
const ALL_CATEGORIES = [
  'FOOD_AND_DRINK', 'TRANSPORTATION', 'ENTERTAINMENT', 'GENERAL_MERCHANDISE',
  'RENT_AND_UTILITIES', 'TRAVEL', 'PERSONAL_CARE', 'GENERAL_SERVICES',
  'MEDICAL', 'LOAN_PAYMENTS', 'BANK_FEES', 'INCOME', 'TRANSFER_IN',
  'TRANSFER_OUT', 'GOVERNMENT_AND_NON_PROFIT', 'INVESTMENT', 'SAVINGS',
]

type TimePeriod = 'week' | 'month' | '6month' | 'year'
type SplitBy = 'overall' | 'account' | 'category'

const PERIODS: { key: TimePeriod; label: string; days: number }[] = [
  { key: 'week', label: '1W', days: 7 },
  { key: 'month', label: '1M', days: 30 },
  { key: '6month', label: '6M', days: 180 },
  { key: 'year', label: '1Y', days: 365 },
]

export function Transactions() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month')
  const [splitBy, setSplitBy] = useState<SplitBy>('overall')
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  // Recategorization
  const { recategorize } = useCategoryOverrides()
  const [editingTxn, setEditingTxn] = useState<{ id: string; merchant: string; category: string | null } | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [applyToAll, setApplyToAll] = useState(true)

  // Chart uses period toggle
  const periodDays = PERIODS.find((p) => p.key === timePeriod)?.days || 30
  const today = todayStr()
  const chartStart = addDays(today, -periodDays)

  // Table has its own independent date range + filters
  const [tableStart, setTableStart] = useState(chartStart)
  const [tableEnd, setTableEnd] = useState(today)
  const [search, setSearch] = useState('')
  const [tableCategory, setTableCategory] = useState('')

  // Sync table dates when period changes
  useEffect(() => {
    setTableStart(addDays(today, -periodDays))
    setTableEnd(today)
  }, [timePeriod])

  const { accounts } = useAccounts()

  // Chart data — uses chart period
  const { transactions: chartTxns } = useTransactions({ startDate: chartStart, endDate: today })
  // Table data — uses table's own date range + filters
  const { transactions: tableTxns, loading } = useTransactions({
    startDate: tableStart,
    endDate: tableEnd,
    search: search || undefined,
    category: tableCategory || undefined,
  })

  // Filter out internal transfers / money market movements from spending
  const EXCLUDED_CATEGORIES = ['TRANSFER_IN', 'TRANSFER_OUT', 'BANK_FEES']
  const spendingTxns = useMemo(() =>
    chartTxns.filter((t) => t.amount > 0 && !EXCLUDED_CATEGORIES.includes(t.category || '')),
    [chartTxns]
  )

  const categories = useMemo(() => {
    const cats = new Set(tableTxns.map((t) => t.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [tableTxns])

  const sorted = useMemo(() => {
    return [...tableTxns].sort((a, b) => {
      const mul = sortAsc ? 1 : -1
      if (sortField === 'date') return mul * a.date.localeCompare(b.date)
      return mul * (a.amount - b.amount)
    })
  }, [tableTxns, sortField, sortAsc])

  // Stats (from chart period)
  const totalSpent = spendingTxns.reduce((s, t) => s + t.amount, 0)
  const totalIncome = chartTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const avgDaily = periodDays > 0 ? totalSpent / periodDays : 0

  // Chart bucket data
  const chartBuckets = useMemo(() => {
    const useWeekly = periodDays > 60
    const bucketCount = useWeekly ? Math.ceil(periodDays / 7) : periodDays
    const bucketDays = useWeekly ? 7 : 1
    return Array.from({ length: bucketCount }, (_, i) => {
      const bEnd = addDays(today, -(bucketCount - 1 - i) * bucketDays)
      const bStart = useWeekly ? addDays(bEnd, -6) : bEnd
      const label = new Date(bEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { start: bStart, end: bEnd, label }
    })
  }, [periodDays, today])

  const overallData = useMemo(() =>
    chartBuckets.map((b) => ({
      label: b.label,
      value: Math.round(spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end).reduce((s, t) => s + t.amount, 0)),
    })), [chartBuckets, spendingTxns])

  const accountKeys = useMemo(() => {
    const ids = [...new Set(spendingTxns.map((t) => t.account_id))]
    const acctMap = new Map(accounts.map((a) => [a.id, a]))
    return ids.map((id, i) => ({ key: id, name: acctMap.get(id)?.name?.replace('Plaid ', '') ?? id.slice(0, 8), color: CHART_COLORS[i % CHART_COLORS.length] }))
  }, [spendingTxns, accounts])

  const byAccountData = useMemo(() =>
    chartBuckets.map((b) => {
      const row: Record<string, string | number> = { label: b.label }
      const bTxns = spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end)
      accountKeys.forEach((a) => { row[a.key] = Math.round(bTxns.filter((t) => t.account_id === a.key).reduce((s, t) => s + t.amount, 0)) })
      return row
    }), [chartBuckets, spendingTxns, accountKeys])

  const topCats = useMemo(() => {
    const map = new Map<string, number>()
    spendingTxns.forEach((t) => { const c = t.category || 'OTHER'; map.set(c, (map.get(c) || 0) + t.amount) })
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 5).map(([name]) => ({ key: name, name: formatCategoryName(name), color: getCategoryColor(name) }))
  }, [spendingTxns])

  const byCategoryData = useMemo(() =>
    chartBuckets.map((b) => {
      const row: Record<string, string | number> = { label: b.label }
      const bTxns = spendingTxns.filter((t) => t.date >= b.start && t.date <= b.end)
      topCats.forEach((c) => { row[c.key] = Math.round(bTxns.filter((t) => (t.category || 'OTHER') === c.key).reduce((s, t) => s + t.amount, 0)) })
      return row
    }), [chartBuckets, spendingTxns, topCats])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    spendingTxns.forEach((t) => { const c = t.category || 'OTHER'; map.set(c, (map.get(c) || 0) + t.amount) })
    return [...map.entries()].map(([name, value]) => ({ name, displayName: formatCategoryName(name), value: Math.round(value * 100) / 100, fill: getCategoryColor(name) })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [spendingTxns])

  // Account totals for horizontal bar
  const accountTotals = useMemo(() =>
    accountKeys.map((a) => ({
      name: a.name,
      value: Math.round(spendingTxns.filter((t) => t.account_id === a.key).reduce((s, t) => s + t.amount, 0)),
      color: a.color,
    })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [accountKeys, spendingTxns]
  )

  // Top merchants
  const topMerchants = useMemo(() => {
    const map = new Map<string, number>()
    spendingTxns.forEach((t) => {
      let n = t.merchant_name || t.name
      n = n.replace(/ACH Electronic Credit/gi, '').replace(/AUTOMATIC PAYMENT - THANK/gi, 'Auto Payment').trim()
      if (n.length > 20) n = n.substring(0, 20) + '...'
      map.set(n, (map.get(n) || 0) + t.amount)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5)
  }, [spendingTxns])

  // Spending insights
  const insights = useMemo(() => {
    const items: { label: string; value: string }[] = []
    // Highest single transaction
    const highest = spendingTxns.reduce((max, t) => t.amount > max.amount ? t : max, spendingTxns[0])
    if (highest) items.push({ label: 'Largest Transaction', value: `${formatCurrency(highest.amount)} — ${(highest.merchant_name || highest.name).substring(0, 20)}` })
    // Highest spend day
    const dayMap = new Map<string, number>()
    spendingTxns.forEach((t) => dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amount))
    const topDay = [...dayMap.entries()].sort(([, a], [, b]) => b - a)[0]
    if (topDay) items.push({ label: 'Highest Spend Day', value: `${formatCurrency(topDay[1])} on ${new Date(topDay[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })
    // Most frequent merchant
    const freqMap = new Map<string, number>()
    spendingTxns.forEach((t) => { const n = t.merchant_name || t.name; freqMap.set(n, (freqMap.get(n) || 0) + 1) })
    const topFreq = [...freqMap.entries()].sort(([, a], [, b]) => b - a)[0]
    if (topFreq) items.push({ label: 'Most Frequent', value: `${topFreq[0].substring(0, 20)} (${topFreq[1]}x)` })
    // Transaction count
    items.push({ label: 'Transactions', value: `${spendingTxns.length} purchases` })
    return items
  }, [spendingTxns])

  const chartData = splitBy === 'overall' ? overallData : splitBy === 'account' ? byAccountData : byCategoryData
  const lineKeys = splitBy === 'account' ? accountKeys : splitBy === 'category' ? topCats : []

  function toggleSort(field: 'date' | 'amount') {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Transactions</h1>
        <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setTimePeriod(p.key)}
              className={`px-3 py-1 text-xs rounded-md transition-all ${timePeriod === p.key ? 'bg-[#6366f1] text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Spent" value={totalSpent} color="#f43f5e" format="currency" />
        <StatCard label="Total Income" value={totalIncome} color="#10b981" format="currency" />
        <StatCard label="Net" value={totalIncome - totalSpent} color={totalIncome - totalSpent >= 0 ? '#10b981' : '#f43f5e'} format="currency" />
        <StatCard label="Daily Average" value={avgDaily} color="#6366f1" format="currency" />
      </div>

      {/* Spending chart */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <ChartLabel>Spending</ChartLabel>
          <div className="flex gap-0.5 bg-[#252839] p-0.5 rounded-lg">
            {([['overall', 'Overall'], ['account', 'By Account'], ['category', 'By Category']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSplitBy(key)}
                className={`px-3 py-1 text-xs rounded-md transition-all ${splitBy === key ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT.large}>
          {splitBy === 'overall' ? (
            <AreaChart data={overallData}>
              <defs>
                <linearGradient id="txOverallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" {...ax} interval={Math.max(0, Math.floor(overallData.length / 7))} />
              <YAxis {...ax} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#txOverallGrad)" name="Spending" />
            </AreaChart>
          ) : splitBy === 'account' ? (
            /* Horizontal bar by account */
            <BarChart data={accountTotals} layout="vertical" barSize={28}>
              <XAxis type="number" {...ax} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <YAxis type="category" dataKey="name" {...ax} width={140} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#6366f110' }} formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Spending">
                {accountTotals.map((a, i) => <Cell key={i} fill={a.color} />)}
              </Bar>
            </BarChart>
          ) : (
            /* Horizontal bar by category */
            <BarChart data={categoryData} layout="vertical" barSize={28}>
              <XAxis type="number" {...ax} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <YAxis type="category" dataKey="displayName" {...ax} width={140} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#6366f110' }} formatter={(v: number) => formatCurrency(v)} contentStyle={tt} wrapperStyle={{ zIndex: 50 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Spending">
                {categoryData.map((c, i) => <Cell key={i} fill={c.fill} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </Card>

      {/* Summary row — only when Overall (extra space) */}
      {splitBy === 'overall' && (
        <div className="grid grid-cols-12 gap-4 animate-fade">
          {/* Top merchants — narrower */}
          <Card className="col-span-3">
            <ChartLabel>Top Merchants</ChartLabel>
            {topMerchants.length > 0 ? (
              <div className="space-y-3">
                {topMerchants.map((m, i) => (
                  <MerchantBar key={m.name} name={m.name} value={m.value} maxValue={topMerchants[0]?.value || 1} color={CHART_COLORS[i % CHART_COLORS.length]} index={i} />
                ))}
              </div>
            ) : <p className="text-gray-600 text-sm py-8 text-center">No data</p>}
          </Card>

          {/* Category breakdown — wider, donut left + list right */}
          <Card className="col-span-5">
            <ChartLabel>Category Breakdown</ChartLabel>
            <div className="flex gap-4">
              <div className="shrink-0" style={{ width: 180, height: 180 }}>
                <DonutChart data={categoryData} height={180} colorMode="category" showLegend={false} emptyMessage="No data" />
              </div>
              <div className="flex-1 min-w-0">
                {categoryData.map((c) => {
                  const total = categoryData.reduce((s, d) => s + d.value, 0)
                  const pct = total > 0 ? (c.value / total) * 100 : 0
                  return (
                    <div key={c.name} className="flex items-center gap-2 py-1.5 border-b border-[#2a2d3d]/30 last:border-0">
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: c.fill }} />
                      <span className="text-[11px] text-gray-300 truncate flex-1">{c.displayName}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">{pct.toFixed(0)}%</span>
                      <span className="text-[11px] text-gray-200 font-medium shrink-0 w-14 text-right">{formatCurrency(c.value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Quick insights */}
          <Card className="col-span-4">
            <ChartLabel>Quick Insights</ChartLabel>
            <div className="space-y-4">
              {insights.map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-white font-medium mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ TRANSACTION TABLE ═══ */}
      <div className="border-t border-[#2a2d3d] pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Transaction List</h2>
          <span className="text-xs text-gray-500">{sorted.length} transaction{sorted.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table filters with date range */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">From</span>
            <input type="date" value={tableStart} onChange={(e) => setTableStart(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#1a1d29] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
            <span className="text-xs text-gray-500">To</span>
            <input type="date" value={tableEnd} onChange={(e) => setTableEnd(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#1a1d29] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
            <button onClick={() => { setTableStart(chartStart); setTableEnd(today) }}
              className="px-2 py-1.5 text-[10px] text-gray-500 hover:text-gray-300 border border-[#2a2d3d] rounded-lg transition-colors">
              Reset
            </button>
          </div>
          <input type="text" placeholder="Search merchants..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#1a1d29] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
          <select value={tableCategory} onChange={(e) => setTableCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#1a1d29] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c} value={c!}>{formatCategoryName(c!)}</option>))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-600 p-8 text-center">Loading...</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-gray-600 p-8 text-center">No transactions found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-[#2a2d3d] bg-[#252839]">
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-gray-300" onClick={() => toggleSort('date')}>
                    Date {sortField === 'date' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-4 py-3 font-medium">Merchant</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-300" onClick={() => toggleSort('amount')}>
                    Amount {sortField === 'amount' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <TransactionRow key={t.id} date={t.date} merchantName={t.merchant_name} name={t.name} category={t.category} amount={t.amount} pending={t.pending}
                    onCategoryClick={() => { setEditingTxn({ id: t.id, merchant: t.merchant_name || t.name, category: t.category }); setNewCategory(t.category || '') }} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recategorize Modal */}
      {editingTxn && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingTxn(null)}>
          <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-6 w-[420px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-1">Recategorize Transaction</h3>
            <p className="text-xs text-gray-500 mb-4">Change the category for this merchant</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Merchant</label>
                <p className="text-sm text-white bg-[#252839] rounded-lg px-3 py-2">{editingTxn.merchant}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Current Category</label>
                <p className="text-sm text-gray-400 bg-[#252839] rounded-lg px-3 py-2">
                  {editingTxn.category ? formatCategoryName(editingTxn.category) : 'Uncategorized'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">New Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50"
                >
                  <option value="">Select category...</option>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{formatCategoryName(c)}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 rounded border-[#2a2d3d] bg-[#252839] text-[#6366f1] focus:ring-[#6366f1]/50"
                />
                <span className="text-xs text-gray-400">
                  Apply to all transactions from "{editingTxn.merchant.substring(0, 25)}"
                </span>
              </label>

              {applyToAll && (
                <p className="text-[10px] text-gray-600 bg-[#252839] rounded-lg px-3 py-2">
                  Future transactions from this merchant will also be automatically categorized as {newCategory ? formatCategoryName(newCategory) : '...'}.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingTxn(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-400 border border-[#2a2d3d] rounded-lg hover:bg-[#252839] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCategory) return
                  await recategorize(editingTxn.id, editingTxn.merchant, editingTxn.category, newCategory, applyToAll)
                  setEditingTxn(null)
                  // Refresh table data
                  window.location.reload()
                }}
                disabled={!newCategory}
                className="flex-1 px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
