// Mode Detection
// Plaid charges per connected account per month (not per API call).
// Once a user has synced transactions, they're already paying — no reason to limit features.
//
// Logic:
// 1. If user has transaction data in DB → already paying → Full Mode (no popup)
// 2. If no transaction data → Free Mode (balance-only, show upgrade popup on Full switch)
// 3. User can manually override via localStorage

const OVERRIDE_KEY = 'mani_mode_override' // 'free' | 'full' | null (auto)

export function getModeOverride(): 'free' | 'full' | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(OVERRIDE_KEY)
  if (val === 'free' || val === 'full') return val
  return null
}

export function setModeOverride(mode: 'free' | 'full' | null): void {
  if (mode === null) {
    localStorage.removeItem(OVERRIDE_KEY)
  } else {
    localStorage.setItem(OVERRIDE_KEY, mode)
  }
}

// Legacy compat
export function isFreeMode(): boolean {
  const override = getModeOverride()
  if (override === 'free') return true
  if (override === 'full') return false
  // Auto: default to free (hook will check DB for transactions)
  return true
}

export function setFreeMode(enabled: boolean): void {
  setModeOverride(enabled ? 'free' : 'full')
}
