import type { Account, Transaction } from './database'

// --- Recurring Detection ---

export interface RecurringExpenseDetection {
  merchantName: string
  normalizedName: string
  amount: number
  amountVariance: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  intervalDays: number
  nextExpectedDate: string
  lastSeenDate: string
  confidenceScore: number
  isSubscription: boolean
  category: string | null
  accountId: string | null
}

// --- Safe to Spend ---

export interface SafeToSpendInput {
  accounts: Account[]
  recurringExpenses: RecurringExpenseResult[]
  currentMonthTransactions: Transaction[]
  goalContributions: number // total monthly contribution across all goals
}

export interface SafeToSpendResult {
  safeToSpendToday: number
  safeToSpendThisWeek: number
  safeToSpendThisMonth: number
  confidence: 'low' | 'medium' | 'high'
  breakdown: {
    availableCash: number
    alreadySpentThisMonth: number
    upcomingRecurring: number
    goalReserves: number
    buffer: number
  }
  explanation: string
}

// --- Overspending Risk ---

export interface OverspendingRiskInput {
  currentMonthTransactions: Transaction[]
  historicalTransactions: Transaction[] // 3-4 months
  recurringExpenses: RecurringExpenseResult[]
  accounts: Account[]
}

export interface OverspendingRiskResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  projectedMonthlySpend: number
  projectedDeficit: number
  burnRate: number
  historicalBurnRate: number
  contributingCategories: { category: string; spent: number; average: number; overage: number }[]
  explanation: string
}

// --- Recommendations ---

export interface Recommendation {
  id: string
  type: 'spending_adjustment' | 'subscription' | 'cash_management' | 'investment' | 'goal' | 'general'
  title: string
  description: string
  impactAmount: number
  urgency: 'low' | 'medium' | 'high'
}

export interface RecommendationsInput {
  safeToSpend: SafeToSpendResult | null
  overspendingRisk: OverspendingRiskResult | null
  recurringExpenses: RecurringExpenseResult[]
  accounts: Account[]
  monthlyExpenses: number
  forecast: ForecastResult | null
}

// --- Forecasting ---

export interface ForecastInput {
  accounts: Account[]
  recurringExpenses: RecurringExpenseResult[]
  recentTransactions: Transaction[] // last 30-60 days for avg daily spend
}

export interface ForecastPoint {
  date: string
  projectedBalance: number
  events: string[]
}

export interface ForecastResult {
  timeline: ForecastPoint[]
  minBalance: number
  minBalanceDate: string
  riskOfNegative: boolean
  daysUntilNegative: number | null
}

// --- Net Worth ---

export interface NetWorthResult {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  cashBalance: number
  investmentBalance: number
  creditBalance: number
  loanBalance: number
  monthlyChange: number
  monthlyChangePercent: number
  insights: string[]
}

// --- Cash Optimization ---

export interface CashOptimizationResult {
  idleCash: number
  recommendedInvestment: number
  cashRatio: number
  emergencyFundMonths: number
  insights: string[]
}

// --- Investment Portfolio ---

export interface InvestmentHoldingView {
  securityName: string
  tickerSymbol: string | null
  quantity: number
  currentValue: number
  costBasis: number | null
  weight: number // percentage of portfolio
  assetClass: string
  gainLoss: number | null
  gainLossPercent: number | null
}

export interface InvestmentPortfolioResult {
  totalValue: number
  totalCostBasis: number | null
  totalGainLoss: number | null
  totalReturnPercent: number | null
  holdings: InvestmentHoldingView[]
  allocationByClass: { assetClass: string; value: number; weight: number }[]
  topHoldings: InvestmentHoldingView[]
  diversificationScore: number // 0-100
}

// --- Performance ---

export interface PerformanceResult {
  totalContributions: number
  totalGainLoss: number
  returnPercentage: number
  explanation: string
}

// --- Goal Tracking ---

export interface GoalTrackingResult {
  goalId: string
  name: string
  type: string
  targetAmount: number
  currentAmount: number
  progressPercent: number
  monthsRemaining: number | null
  requiredMonthlyContribution: number
  currentMonthlyContribution: number
  feasibility: 'on_track' | 'at_risk' | 'behind'
  gap: number
}

// --- Shared type for recurring expenses from DB ---

export interface RecurringExpenseResult {
  id: string
  merchantName: string
  normalizedName: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly'
  intervalDays: number
  nextExpectedDate: string
  lastSeenDate: string
  confidenceScore: number
  isSubscription: boolean
  isDismissed: boolean
  category: string | null
  accountId: string | null
}
