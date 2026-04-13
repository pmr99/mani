import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, ACCOUNT_TYPE_CONFIG } from '../lib/engines/utils'
import { useFreeMode } from '../hooks/useFreeMode'
import { SyncButton } from './SyncButton'

const links = [
  { to: '/', label: 'Dashboard', icon: '*' },
  { to: '/wealth', label: 'Wealth', icon: '^' },
  { to: '/transactions', label: 'Transactions', icon: '$' },
  { to: '/analysis', label: 'Insights', icon: '%' },
]

const TYPE_ORDER = ['credit', 'depository', 'investment', 'loan']

export function Sidebar() {
  const { accounts } = useAccounts()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const freeMode = useFreeMode()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Group accounts by type
  const grouped = TYPE_ORDER
    .map((type) => {
      const accts = accounts.filter((a) => a.type === type)
      const total = accts.reduce((s, a) => s + (a.current_balance ?? 0), 0)
      return { type, config: ACCOUNT_TYPE_CONFIG[type], accounts: accts, total }
    })
    .filter((g) => g.accounts.length > 0)

  function toggleGroup(type: string) {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 border-r border-[#2a2d3d] bg-[#0f1117] h-screen sticky top-0 p-4 flex-col gap-1 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-3 py-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <span className="text-lg font-bold text-white tracking-tight">Mani</span>
      </div>

      {/* Navigation */}
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#6366f1] text-white'
                : 'text-gray-400 hover:bg-[#1a1d29] hover:text-white'
            }`
          }
        >
          <span className="w-5 text-center font-mono text-xs">{link.icon}</span>
          {link.label}
        </NavLink>
      ))}

      {/* Account Tree */}
      <div className="border-t border-[#2a2d3d] mt-4 pt-4 mb-2 flex items-center justify-between px-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accounts</p>
        <button
          onClick={() => navigate('/accounts')}
          className="text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors font-medium"
          title="Link a new account"
        >
          + Link
        </button>
      </div>

      {grouped.length === 0 && (
        <button
          onClick={() => navigate('/accounts')}
          className="mx-3 py-2 text-xs text-gray-600 hover:text-gray-400 text-center rounded-lg border border-dashed border-[#2a2d3d] hover:border-[#6366f1] transition-colors"
        >
          No accounts linked
        </button>
      )}

      {grouped.length > 0 && (
        <>
          {grouped.map((group) => (
            <div key={group.type}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.type)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1a1d29] transition-colors"
              >
                <span
                  className="text-[10px] transition-transform shrink-0"
                  style={{ transform: expanded[group.type] ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  ▶
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: group.config?.color || '#6b7280' }}
                />
                <span
                  className="truncate cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/accounts?type=${group.type}`)
                  }}
                >
                  {group.config?.label || group.type}
                </span>
                <span className="text-xs text-gray-500 font-mono ml-auto shrink-0">
                  {formatCurrency(group.type === 'credit' || group.type === 'loan' ? -group.total : group.total)}
                </span>
              </button>

              {/* Expanded accounts */}
              {expanded[group.type] && (
                <div className="ml-5 space-y-0.5">
                  {group.accounts.map((acct) => (
                    <button
                      key={acct.id}
                      onClick={() => navigate(`/accounts/${acct.id}`)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:bg-[#1a1d29] hover:text-gray-200 transition-colors"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: group.config?.color || '#6b7280' }}
                      />
                      <span className="truncate min-w-0">
                        {acct.name}
                        {acct.mask ? ` ****${acct.mask}` : ''}
                      </span>
                      <span className="font-mono ml-auto shrink-0 text-gray-500">
                        {formatCurrency(acct.current_balance ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Bottom — Mode Toggle + Sync */}
      <div className="mt-auto pt-4 border-t border-[#2a2d3d] space-y-3">
        {!freeMode.isFree && <SyncButton />}
        <div className="px-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => freeMode.setMode('free')}
              className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg text-center transition-all ${freeMode.isFree ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-gray-300 bg-[#252839]'}`}
            >
              Free
            </button>
            <button
              onClick={() => {
                if (freeMode.isFree && freeMode.shouldShowUpgradeWarning) {
                  setShowUpgradeModal(true) // First time — show pricing warning
                } else {
                  freeMode.setMode('full') // Already paying — switch directly
                }
              }}
              className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg text-center transition-all ${!freeMode.isFree ? 'bg-[#6366f1] text-white' : 'text-gray-500 hover:text-gray-300 bg-[#252839]'}`}
            >
              Full
            </button>
          </div>
          <p className="text-[9px] text-gray-600 text-center">
            {freeMode.isFree ? 'Balances only · $0/mo' : freeMode.hasPaidData ? 'All features · already active' : 'All features · ~$3/mo'}
          </p>
        </div>
      </div>

      {/* Upgrade confirmation modal — portal to escape sidebar stacking context */}
      {showUpgradeModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Switch to Full Mode?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Full Mode uses paid Plaid API calls to fetch transaction history, investment holdings, and spending data.
            </p>
            <div className="bg-[#252839] rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Transactions</span>
                <span className="text-gray-300">$0.30/account/month</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Investment Holdings</span>
                <span className="text-gray-300">$0.18/account/month</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Investment History</span>
                <span className="text-gray-300">$0.35/account/month</span>
              </div>
              <div className="border-t border-[#2a2d3d] pt-2 flex justify-between text-xs">
                <span className="text-gray-400">Estimated total</span>
                <span className="text-white font-semibold">~$3/month</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mb-4">
              Charges are from Plaid, not Mani. You can switch back to Free Mode anytime.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 text-sm text-gray-400 border border-[#2a2d3d] rounded-lg hover:bg-[#252839] transition-colors"
              >
                Stay on Free
              </button>
              <button
                onClick={() => { setShowUpgradeModal(false); freeMode.setMode('full') }}
                className="flex-1 px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] transition-colors"
              >
                Switch to Full
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  )
}
