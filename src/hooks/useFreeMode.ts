import { useState, useEffect } from 'react'
import { getModeOverride, setModeOverride } from '../lib/freeMode'
import { supabase } from '../lib/supabase'

// Auto-detects mode: if user has transactions in DB, they're already paying → Full Mode
// User can manually override. Plaid charges per account/month not per call,
// so once paying, unlimited syncs are free.

export function useFreeMode() {
  const [mode, setMode] = useState<'free' | 'full'>('free')
  const [loading, setLoading] = useState(true)
  const [hasPaidData, setHasPaidData] = useState(false)

  useEffect(() => {
    async function detect() {
      const override = getModeOverride()

      // Check if user already has transaction data (meaning they've used paid APIs)
      const { data } = await supabase
        .from('transactions')
        .select('id')
        .limit(1)
      const hasTransactions = (data?.length ?? 0) > 0
      setHasPaidData(hasTransactions)

      if (override) {
        // User explicitly chose a mode
        setMode(override)
      } else if (hasTransactions) {
        // Auto-detect: has paid data → Full Mode (already paying per-account/month)
        setMode('full')
      } else {
        // No data, no override → Free Mode
        setMode('free')
      }
      setLoading(false)
    }
    detect()
  }, [])

  const isFree = mode === 'free'

  function setModeAndReload(newMode: 'free' | 'full') {
    setModeOverride(newMode)
    window.location.reload()
  }

  // Should we show the paid API warning popup?
  // Only if user has NEVER used paid APIs before (no transaction data)
  const shouldShowUpgradeWarning = !hasPaidData

  return {
    isFree,
    loading,
    hasPaidData,
    shouldShowUpgradeWarning,
    setMode: setModeAndReload,
    toggle: () => setModeAndReload(isFree ? 'full' : 'free'),
  }
}
