import { useFreeMode } from '../hooks/useFreeMode'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useInvestments } from '../hooks/useInvestments'
import { usePlaidLink } from '../hooks/usePlaidLink'
import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, ACCOUNT_TYPE_CONFIG, getCategoryColor, formatCategoryName, CHART_COLORS } from '../lib/engines/utils'
import {
  Card, ChartLabel, TruncatedText, CategoryBadge, Amount, DonutChart, StatCard,
  TransactionRow, chartTooltipStyle as tt, chartAxisProps as ax, CHART_HEIGHT,
} from '../components/ui'

// tooltipStyle imported from ui.tsx

export function Accounts() {
  const { accountId } = useParams()
  const [searchParams] = useSearchParams()
  const typeFilter = searchParams.get('type')

  const { isFree } = useFreeMode()
  const { accounts, loading, refetch } = useAccounts()
  const { transactions } = useTransactions({ months: 1 })
  const { createLinkToken, open, ready, loading: linkLoading } = usePlaidLink(refetch)

  useEffect(() => { createLinkToken() }, [createLinkToken])

  const { holdings } = useInvestments()

  // Derived data for single account view — hooks must be at top level, never inside conditionals
  const account = accounts.find((a) => a.id === accountId)
  const acctTxns = useMemo(() => transactions.filter((t) => t.account_id === accountId), [transactions, accountId])
  const acctHoldings = useMemo(() => holdings.filter((h) => h.account_id === accountId), [holdings, accountId])

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    acctTxns.filter((t) => t.amount > 0).forEach((t) => {
      const cat = t.category || 'OTHER'
      map.set(cat, (map.get(cat) || 0) + t.amount)
    })
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [acctTxns])

  const monthlySpending = useMemo(() => {
    const map = new Map<string, number>()
    acctTxns.filter((t) => t.amount > 0).forEach((t) => {
      const mk = t.date.substring(0, 7)
      map.set(mk, (map.get(mk) || 0) + t.amount)
    })
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, v]) => ({ month: new Date(mk + '-01').toLocaleDateString('en-US', { month: 'short' }), spent: Math.round(v) }))
  }, [acctTxns])

  // Single account detail view
  if (accountId) {
    if (!account) return <div className="p-6"><p className="text-gray-500">Account not found</p></div>

    const config = ACCOUNT_TYPE_CONFIG[account.type]
    const isInvestment = account.type === 'investment'
    const isCredit = account.type === 'credit'
    const isLoan = account.type === 'loan'

    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config?.color || '#6b7280' }} />
          <h1 className="text-2xl font-semibold text-white">{account.name}</h1>
          {account.mask && <span className="text-gray-500">****{account.mask}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#252839] text-gray-400">{account.subtype || account.type}</span>
        </div>

        {/* Stat cards — context-aware */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label={isCredit ? 'Balance Owed' : isLoan ? 'Outstanding' : 'Balance'}
            value={account.current_balance ?? 0}
            color={config?.color || '#6b7280'}
            format="currency"
          />
          {isCredit && (
            <StatCard label="Available Credit" value={account.available_balance ?? 0} color="#10b981" format="currency" />
          )}
          {!isCredit && !isInvestment && (
            <StatCard label="Available" value={account.available_balance ?? account.current_balance ?? 0} color="#3b82f6" format="currency" />
          )}
          {isInvestment && (
            <StatCard label="Holdings" value={acctHoldings.length} color="#8b5cf6" />
          )}
          <StatCard
            label={isInvestment ? 'Account Type' : isCredit ? 'Card Type' : 'Account Type'}
            value={0}
            color={config?.color || '#6b7280'}
          />
        </div>

        {/* Investment accounts: show holdings breakdown */}
        {isInvestment && !isFree && (
          <>
            {acctHoldings.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <ChartLabel>Holdings by Value</ChartLabel>
                  <DonutChart
                    data={acctHoldings.map((h) => ({ name: h.ticker_symbol || h.security_name, value: h.current_value }))}
                    height={CHART_HEIGHT.large} colorMode="palette"
                  />
                </Card>
                <Card>
                  <ChartLabel>Holdings Detail</ChartLabel>
                  <div className="space-y-3">
                    {acctHoldings.sort((a, b) => b.current_value - a.current_value).map((h) => (
                      <div key={h.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">{h.ticker_symbol || h.security_name}</p>
                          <p className="text-xs text-gray-500">{h.quantity.toFixed(2)} shares · {h.asset_class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">{formatCurrency(h.current_value)}</p>
                          {h.cost_basis != null && (
                            <p className={`text-xs ${h.current_value >= h.cost_basis ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {h.current_value >= h.cost_basis ? '+' : ''}{formatCurrency(h.current_value - h.cost_basis)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : (
              <Card>
                <ChartLabel>Holdings</ChartLabel>
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No holdings data synced yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Holdings require Plaid investments product. Balance: {formatCurrency(account.current_balance ?? 0)}</p>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Credit/Checking: spending breakdown + monthly chart */}
        {!isFree && (isCredit || account.type === 'depository') && (
          <div className="grid grid-cols-2 gap-4">
            {categoryBreakdown.length > 0 && (
              <Card>
                <ChartLabel>Spending by Category</ChartLabel>
                <DonutChart data={categoryBreakdown} height={CHART_HEIGHT.large} colorMode="category" />
              </Card>
            )}
            {monthlySpending.length > 0 && (
              <Card>
                <ChartLabel>Monthly Spending</ChartLabel>
                <ResponsiveContainer width="100%" height={CHART_HEIGHT.medium}>
                  <BarChart data={monthlySpending}>
                    <XAxis dataKey="month" {...ax} />
                    <YAxis {...ax} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tt} />
                    <Bar dataKey="spent" fill={config?.color || '#6366f1'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}

        {/* Free mode: prominent balance for credit/depository */}
        {isFree && (isCredit || account.type === 'depository') && (
          <Card>
            <ChartLabel>{isCredit ? 'Credit Card Balance' : 'Account Balance'}</ChartLabel>
            <div className="py-6 text-center space-y-4">
              <p className="text-4xl font-bold text-white">{formatCurrency(account.current_balance ?? 0)}</p>
              {isCredit && account.available_balance != null && (
                <p className="text-lg text-emerald-400">Available Credit: {formatCurrency(account.available_balance)}</p>
              )}
              {!isCredit && account.available_balance != null && account.available_balance !== account.current_balance && (
                <p className="text-lg text-blue-400">Available: {formatCurrency(account.available_balance)}</p>
              )}
              <p className="text-xs text-gray-500">Transaction data is not available in Free Mode</p>
            </div>
          </Card>
        )}

        {/* Loan accounts: payoff info */}
        {isLoan && (
          <Card>
            <ChartLabel>Loan Details</ChartLabel>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(account.current_balance ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Loan Type</p>
                <p className="text-lg font-semibold text-white mt-1">{account.subtype || 'Loan'}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Recent transactions — for non-investment accounts */}
        {!isFree && !isInvestment && (
          <Card>
            <ChartLabel>Recent Transactions</ChartLabel>
            {acctTxns.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-[#2a2d3d]">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Merchant</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {acctTxns.slice(0, 15).map((t) => (
                    <TransactionRow key={t.id} date={t.date} merchantName={t.merchant_name} name={t.name} category={t.category} amount={t.amount} pending={t.pending} />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-600 py-4">No recent transactions</p>
            )}
          </Card>
        )}
      </div>
    )
  }

  // Filter by type if query param present
  const filteredAccounts = typeFilter
    ? accounts.filter((a) => a.type === typeFilter)
    : accounts

  // Group by type
  const grouped = useMemo(() => {
    const types = ['credit', 'depository', 'investment', 'loan']
    return types
      .map((type) => ({
        type,
        config: ACCOUNT_TYPE_CONFIG[type],
        accounts: filteredAccounts.filter((a) => a.type === type),
        total: filteredAccounts.filter((a) => a.type === type).reduce((s, a) => s + (a.current_balance ?? 0), 0),
      }))
      .filter((g) => g.accounts.length > 0)
  }, [filteredAccounts])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">
          {typeFilter ? ACCOUNT_TYPE_CONFIG[typeFilter]?.label || 'Accounts' : 'Accounts'}
        </h1>
        <button onClick={() => open()} disabled={!ready || linkLoading}
          className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] disabled:opacity-50 transition-colors">
          {linkLoading ? 'Loading...' : '+ Link Account'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading accounts...</p>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-2">No accounts linked yet</p>
          <p className="text-sm text-gray-600">Click "Link Account" to connect your bank via Plaid</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.type} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-[#252839] border-b border-[#2a2d3d] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.config?.color || '#6b7280' }} />
                  <h2 className="text-sm font-medium text-gray-300">{group.config?.label || group.type}</h2>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(group.total)}</span>
              </div>
              <div className="divide-y divide-[#2a2d3d]/50">
                {group.accounts.map((account) => (
                  <div key={account.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#252839] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{account.name}</p>
                      <p className="text-xs text-gray-500">
                        {account.subtype || account.type}{account.mask ? ` ****${account.mask}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{formatCurrency(account.current_balance ?? 0)}</p>
                      {account.available_balance != null && account.available_balance !== account.current_balance && (
                        <p className="text-xs text-gray-500">{formatCurrency(account.available_balance)} available</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
