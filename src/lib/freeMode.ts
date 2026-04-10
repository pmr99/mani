// Free Mode — only uses /accounts/get (free unlimited Plaid calls)
// When enabled: balances, net worth, account structure all work
// When disabled: full transaction history, investment holdings, spending analysis

const STORAGE_KEY = 'mani_free_mode'

export function isFreeMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setFreeMode(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}
