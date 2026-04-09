import type { ForecastInput, ForecastResult, ForecastPoint, RecurringExpenseResult } from '../../types/engines'
import { addDays, todayStr, mean } from './utils'

function getRecurringOnDate(expenses: RecurringExpenseResult[], date: string): { name: string; amount: number }[] {
  const events: { name: string; amount: number }[] = []
  for (const exp of expenses) {
    if (exp.isDismissed) continue
    // Check if this date matches the expected date (or a future recurrence)
    let nextDate = exp.nextExpectedDate
    while (nextDate < date) {
      nextDate = addDays(nextDate, exp.intervalDays)
    }
    if (nextDate === date) {
      events.push({ name: exp.normalizedName, amount: exp.amount })
    }
  }
  return events
}

export function computeForecast(input: ForecastInput): ForecastResult {
  const { accounts, recurringExpenses, recentTransactions } = input

  // Starting balance: sum of depository available balances
  let balance = accounts
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.available_balance ?? a.current_balance ?? 0), 0)

  // Average daily discretionary spend (excluding recurring, from last 30 days)
  const today = todayStr()
  const thirtyDaysAgo = addDays(today, -30)
  const recentExpenses = recentTransactions.filter(
    (t) => t.amount > 0 && t.date >= thirtyDaysAgo && t.date <= today
  )
  const totalRecentSpend = recentExpenses.reduce((s, t) => s + t.amount, 0)

  // Subtract known recurring from recent spend to get discretionary
  const monthlyRecurring = recurringExpenses
    .filter((e) => !e.isDismissed)
    .reduce((s, e) => {
      if (e.frequency === 'monthly') return s + e.amount
      if (e.frequency === 'weekly') return s + e.amount * 4.33
      if (e.frequency === 'yearly') return s + e.amount / 12
      return s
    }, 0)

  const discretionaryMonthly = Math.max(0, totalRecentSpend - monthlyRecurring)
  const avgDailyDiscretionary = discretionaryMonthly / 30

  // Expected income (negative amounts = income in Plaid)
  const recentIncome = recentTransactions.filter(
    (t) => t.amount < 0 && t.date >= thirtyDaysAgo && t.date <= today
  )
  // Find likely paycheck dates by looking at income patterns
  const incomeAmounts = recentIncome.map((t) => Math.abs(t.amount))
  const avgDailyIncome = incomeAmounts.reduce((s, a) => s + a, 0) / 30

  // Walk forward 30 days
  const timeline: ForecastPoint[] = []
  let minBalance = balance
  let minBalanceDate = today
  let riskOfNegative = false
  let daysUntilNegative: number | null = null

  for (let i = 1; i <= 30; i++) {
    const date = addDays(today, i)
    const events: string[] = []

    // Recurring expenses on this date
    const recurring = getRecurringOnDate(recurringExpenses, date)
    for (const r of recurring) {
      balance -= r.amount
      events.push(`-${r.name}: $${r.amount.toFixed(0)}`)
    }

    // Average daily discretionary spend
    balance -= avgDailyDiscretionary

    // Average daily income (smoothed)
    balance += avgDailyIncome

    if (balance < minBalance) {
      minBalance = balance
      minBalanceDate = date
    }

    if (balance < 0 && !riskOfNegative) {
      riskOfNegative = true
      daysUntilNegative = i
    }

    timeline.push({
      date,
      projectedBalance: Math.round(balance * 100) / 100,
      events,
    })
  }

  return {
    timeline,
    minBalance: Math.round(minBalance * 100) / 100,
    minBalanceDate,
    riskOfNegative,
    daysUntilNegative,
  }
}
