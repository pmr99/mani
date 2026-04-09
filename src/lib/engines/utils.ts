export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`
  }
  return formatCurrency(amount)
}

export function formatCategoryName(plaidCategory: string): string {
  return plaidCategory
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#*\d]+$/g, '') // strip trailing numbers/symbols
    .replace(/\s+/g, ' ')
    .trim()
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.round(Math.abs(db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

export function daysRemainingInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return lastDay - now.getDate()
}

export function dayOfMonth(): number {
  return new Date().getDate()
}

export function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map((v) => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((s, v) => s + v, 0) / (values.length - 1))
}

export function addDays(date: string | Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function isAssetAccount(type: string): boolean {
  return type === 'depository' || type === 'investment'
}

export function isLiabilityAccount(type: string): boolean {
  return type === 'credit' || type === 'loan'
}

export function isCashAccount(type: string): boolean {
  return type === 'depository'
}

// Category color system
export const CATEGORY_COLORS: Record<string, string> = {
  FOOD_AND_DRINK: '#f59e0b',
  TRANSPORTATION: '#3b82f6',
  ENTERTAINMENT: '#ec4899',
  GENERAL_MERCHANDISE: '#8b5cf6',
  SHOPPING: '#8b5cf6',
  RENT_AND_UTILITIES: '#06b6d4',
  TRANSFER_IN: '#10b981',
  TRANSFER_OUT: '#6366f1',
  INCOME: '#10b981',
  LOAN_PAYMENTS: '#f43f5e',
  BANK_FEES: '#ef4444',
  PERSONAL_CARE: '#d946ef',
  GENERAL_SERVICES: '#14b8a6',
  MEDICAL: '#f97316',
  TRAVEL: '#0ea5e9',
  GOVERNMENT_AND_NON_PROFIT: '#64748b',
}

export const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#06b6d4', '#f43f5e', '#d946ef', '#14b8a6',
]

export const ACCOUNT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  credit: { label: 'Credit Cards', color: '#f43f5e' },
  depository: { label: 'Banks', color: '#10b981' },
  investment: { label: 'Investments', color: '#6366f1' },
  loan: { label: 'Loans', color: '#f59e0b' },
}

export function getCategoryColor(category: string | null): string {
  if (!category) return '#6b7280'
  return CATEGORY_COLORS[category.toUpperCase()] || CATEGORY_COLORS[category] || '#6b7280'
}
