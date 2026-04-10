import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { isFreeMode } from '../lib/freeMode'

export function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const free = isFreeMode()

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    try {
      if (free) {
        // Free mode — only refresh balances (uses /accounts/get which is free)
        const { data, error } = await supabase.functions.invoke('refresh-balances')
        if (error) throw error
        setResult(`${data.accounts_refreshed} accounts refreshed (free)`)
      } else {
        // Full mode — sync transactions + investments (uses paid API calls)
        const { data, error } = await supabase.functions.invoke('sync-transactions')
        if (error) throw error
        setResult(`+${data.added} / ~${data.modified} / -${data.removed}`)
      }
      onSynced?.()
    } catch (err) {
      setResult('Sync failed')
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-3 py-1.5 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] disabled:opacity-50 transition-colors"
      >
        {syncing ? 'Syncing...' : free ? 'Refresh' : 'Sync'}
      </button>
      {result && (
        <span className="text-xs text-gray-500">{result}</span>
      )}
    </div>
  )
}
