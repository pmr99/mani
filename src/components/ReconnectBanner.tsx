import { useEffect, useState } from 'react'
import { useStaleItems } from '../hooks/useStaleItems'
import { usePlaidLink } from '../hooks/usePlaidLink'
import { CsvImportModal } from './CsvImportModal'

// Shows a warning banner listing items needing action:
//   - Plaid items in error state (ITEM_LOGIN_REQUIRED) → open update-mode Plaid Link
//   - CSV-imported items older than 14 days → open the CSV import modal
export function ReconnectBanner() {
  const { items, refetch } = useStaleItems()
  const [showCsvModal, setShowCsvModal] = useState(false)

  const { createUpdateLinkToken, open, ready, loading } = usePlaidLink(() => {
    setTimeout(() => refetch(), 1000)
  })

  // Auto-open Plaid Link when the update token becomes ready
  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  if (items.length === 0) return null

  const plaidCount = items.filter((i) => i.kind === 'plaid_error').length
  const csvCount = items.filter((i) => i.kind === 'csv_outdated').length

  return (
    <>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 sm:p-4">
        <div className="flex items-start gap-2 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-400">
              {items.length === 1 ? '1 account needs' : `${items.length} accounts need`} attention
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {plaidCount > 0 && <>Your bank requires re-verification. </>}
              {csvCount > 0 && <>Some CSV imports are stale — upload a fresh export to refresh balances.</>}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 mt-3">
          {items.map((item) => {
            const isCsv = item.kind === 'csv_outdated'
            const label = isCsv
              ? `${item.institution_name} · ${item.age_days}d old`
              : item.institution_name
            const actionLabel = isCsv ? 'Re-upload' : (loading ? 'Loading…' : 'Reconnect')
            const onAction = isCsv
              ? () => setShowCsvModal(true)
              : () => createUpdateLinkToken(item.id)

            return (
              <div key={item.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isCsv ? (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">CSV</span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 shrink-0">AUTH</span>
                  )}
                  <span className="text-sm text-gray-200 truncate">{label}</span>
                </div>
                <button
                  onClick={onAction}
                  disabled={!isCsv && loading}
                  className="px-3 py-1 text-xs font-medium bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50 transition-colors shrink-0"
                >
                  {actionLabel}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onSuccess={() => {
            setShowCsvModal(false)
            refetch()
          }}
        />
      )}
    </>
  )
}
