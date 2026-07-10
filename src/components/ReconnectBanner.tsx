import { useEffect } from 'react'
import { useStaleItems } from '../hooks/useStaleItems'
import { usePlaidLink } from '../hooks/usePlaidLink'

// Shows a warning banner listing institutions that need reauthentication (ITEM_LOGIN_REQUIRED etc.)
// Tap Reconnect on a row → opens Plaid Link in update mode → after success, refreshes.
export function ReconnectBanner() {
  const { items, refetch } = useStaleItems()
  const { createUpdateLinkToken, open, ready, loading } = usePlaidLink(() => {
    // After successful reconnect + refresh, refetch the stale list
    setTimeout(() => refetch(), 1000)
  })

  // Auto-open Plaid Link when the update token becomes ready
  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  if (items.length === 0) return null

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 sm:p-4">
      <div className="flex items-start gap-2 mb-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-400">
            {items.length === 1 ? '1 account needs' : `${items.length} accounts need`} reconnection
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Your bank requires you to re-verify your login. Balances have stopped updating.
          </p>
        </div>
      </div>
      <div className="space-y-1.5 mt-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-200 truncate">{item.institution_name}</span>
            <button
              onClick={() => createUpdateLinkToken(item.id)}
              disabled={loading}
              className="px-3 py-1 text-xs font-medium bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50 transition-colors shrink-0 ml-2"
            >
              {loading ? 'Loading…' : 'Reconnect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
