export interface Database {
  public: {
    Tables: {
      plaid_items: {
        Row: PlaidItem
        Insert: Omit<PlaidItem, 'id' | 'created_at' | 'last_synced_at'>
        Update: Partial<Omit<PlaidItem, 'id'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'updated_at'>
        Update: Partial<Omit<Account, 'id'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'>
        Update: Partial<Omit<Transaction, 'id'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at'>
        Update: Partial<Omit<Budget, 'id'>>
      }
      recurring_expenses: {
        Row: RecurringExpense
        Insert: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RecurringExpense, 'id'>>
      }
      net_worth_snapshots: {
        Row: NetWorthSnapshot
        Insert: Omit<NetWorthSnapshot, 'id' | 'created_at'>
        Update: Partial<Omit<NetWorthSnapshot, 'id'>>
      }
      goals: {
        Row: Goal
        Insert: Omit<Goal, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Goal, 'id'>>
      }
      investment_holdings: {
        Row: InvestmentHolding
        Insert: Omit<InvestmentHolding, 'id' | 'updated_at'>
        Update: Partial<Omit<InvestmentHolding, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export interface PlaidItem {
  id: string
  access_token: string
  institution_id: string
  institution_name: string
  cursor: string | null
  last_synced_at: string | null
  created_at: string
}

export interface Account {
  id: string
  plaid_item_id: string
  plaid_account_id: string
  name: string
  type: string
  subtype: string | null
  mask: string | null
  current_balance: number | null
  available_balance: number | null
  updated_at: string
}

export interface Transaction {
  id: string
  account_id: string
  plaid_transaction_id: string
  amount: number
  date: string
  name: string
  merchant_name: string | null
  category: string | null
  pending: boolean
  created_at: string
}

export interface Budget {
  id: string
  category: string
  monthly_limit: number
  created_at: string
}

export interface RecurringExpense {
  id: string
  merchant_name: string
  normalized_name: string
  amount: number
  amount_variance: number
  frequency: string
  interval_days: number
  next_expected_date: string
  last_seen_date: string
  confidence_score: number
  is_subscription: boolean
  is_dismissed: boolean
  category: string | null
  account_id: string | null
  created_at: string
  updated_at: string
}

export interface NetWorthSnapshot {
  id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  cash_balance: number
  investment_balance: number
  credit_balance: number
  loan_balance: number
  created_at: string
}

export interface Goal {
  id: string
  name: string
  type: string
  target_amount: number
  current_amount: number
  deadline: string | null
  monthly_contribution: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InvestmentHolding {
  id: string
  account_id: string
  security_name: string
  ticker_symbol: string | null
  quantity: number
  cost_basis: number | null
  current_value: number
  asset_class: string
  sector: string | null
  updated_at: string
}

export interface InvestmentTransaction {
  id: string
  account_id: string
  plaid_investment_transaction_id: string
  security_name: string | null
  ticker_symbol: string | null
  type: string
  subtype: string | null
  amount: number
  quantity: number
  price: number
  date: string
  created_at: string
}

export interface PortfolioDailyValue {
  id: string
  account_id: string
  date: string
  value: number
  created_at: string
}
