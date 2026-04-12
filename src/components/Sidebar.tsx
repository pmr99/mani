import { useState } from 'react'
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
    <aside className="w-60 shrink-0 border-r border-[#2a2d3d] bg-[#0f1117] h-screen sticky top-0 p-4 flex flex-col gap-1 overflow-y-auto">
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
      {grouped.length > 0 && (
        <>
          <div className="border-t border-[#2a2d3d] mt-4 pt-4 mb-2">
            <p className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Accounts</p>
          </div>

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

      {/* Bottom — Sync + Mode Toggle */}
      <div className="mt-auto pt-4 border-t border-[#2a2d3d] space-y-3">
        <SyncButton />
        <div className="px-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { freeMode.setMode(true) }}
              className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg text-center transition-all ${freeMode.isFree ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-gray-300 bg-[#252839]'}`}
            >
              Free
            </button>
            <button
              onClick={() => { freeMode.setMode(false) }}
              className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg text-center transition-all ${!freeMode.isFree ? 'bg-[#6366f1] text-white' : 'text-gray-500 hover:text-gray-300 bg-[#252839]'}`}
            >
              Full
            </button>
          </div>
          <p className="text-[9px] text-gray-600 text-center">
            {freeMode.isFree ? 'Balances only · $0/mo' : 'All features · ~$3/mo'}
          </p>
        </div>
      </div>
    </aside>
  )
}
