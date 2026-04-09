import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PLAID_BASE_URL: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const baseUrl = PLAID_BASE_URL[PLAID_ENV]

    const { data: items } = await supabase.from('plaid_items').select('*')
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No linked accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalTransactions = 0
    let totalDailyValues = 0

    for (const item of items) {
      // Get investment accounts for this item
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, plaid_account_id, type, current_balance, name')
        .eq('plaid_item_id', item.id)

      const investmentAccounts = (accounts || []).filter((a) => a.type === 'investment')
      if (investmentAccounts.length === 0) continue

      const accountMap = new Map(investmentAccounts.map((a) => [a.plaid_account_id, a]))

      // Fetch up to 24 months of investment transactions
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // ~2 years

      let allInvestTxns: any[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        try {
          const res = await fetch(`${baseUrl}/investments/transactions/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: PLAID_CLIENT_ID,
              secret: PLAID_SECRET,
              access_token: item.access_token,
              start_date: startDate,
              end_date: endDate,
              options: { offset, count: 500 },
            }),
          })
          const data = await res.json()

          if (data.error) {
            // investments product might not be available for this item
            break
          }

          const txns = data.investment_transactions || []
          const securities = new Map(
            (data.securities || []).map((s: any) => [s.security_id, s])
          )

          // Map and store transactions
          const rows = txns
            .filter((t: any) => accountMap.has(t.account_id))
            .map((t: any) => {
              const security = securities.get(t.security_id) || {}
              return {
                account_id: accountMap.get(t.account_id)!.id,
                plaid_investment_transaction_id: t.investment_transaction_id,
                security_name: security.name || t.name || 'Unknown',
                ticker_symbol: security.ticker_symbol || null,
                type: t.type || 'other',
                subtype: t.subtype || null,
                amount: t.amount || 0,
                quantity: t.quantity || 0,
                price: t.price || 0,
                date: t.date,
              }
            })

          if (rows.length > 0) {
            await supabase
              .from('investment_transactions')
              .upsert(rows, { onConflict: 'plaid_investment_transaction_id' })
            totalTransactions += rows.length
          }

          allInvestTxns = allInvestTxns.concat(txns)
          offset += txns.length
          hasMore = offset < (data.total_investment_transactions || 0)
        } catch {
          break
        }
      }

      // === Reconstruct daily portfolio values ===
      // Strategy: Start from current value, walk backwards through transactions
      // Each day without a transaction keeps the previous day's value
      // Buy transactions: subtract from past (we had less before buying)
      // Sell transactions: add to past (we had more before selling)

      for (const acct of investmentAccounts) {
        const currentValue = acct.current_balance || 0

        // Get all investment transactions for this account, sorted by date desc
        const acctTxns = allInvestTxns
          .filter((t: any) => accountMap.get(t.account_id)?.id === acct.id)
          .sort((a: any, b: any) => b.date.localeCompare(a.date))

        // Build daily values going backwards from today
        const dailyValues: { account_id: string; date: string; value: number }[] = []
        let runningValue = currentValue
        const today = new Date()
        const lookbackDays = 730 // 2 years

        // Create a map of transaction amounts by date
        const txnsByDate = new Map<string, number>()
        for (const t of acctTxns) {
          const existing = txnsByDate.get(t.date) || 0
          // amount is positive for buys (money out), negative for sells (money in)
          // To go backwards: buys mean we had less before, sells mean we had more
          txnsByDate.set(t.date, existing + (t.amount || 0))
        }

        // Walk backwards day by day
        for (let i = 0; i <= lookbackDays; i++) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]

          dailyValues.push({
            account_id: acct.id,
            date: dateStr,
            value: Math.round(runningValue * 100) / 100,
          })

          // Adjust running value for this day's transactions
          // If there was a buy on this date, subtract it (we had less before)
          // If there was a sell, add it back (we had more before)
          const dayTxnAmount = txnsByDate.get(dateStr)
          if (dayTxnAmount !== undefined) {
            // Plaid: buy amount is positive (cost), sell amount is negative (proceeds)
            // Going backwards: reverse the effect
            runningValue -= dayTxnAmount
          }
        }

        // Upsert daily values (sample every few days to avoid huge inserts)
        // Keep daily for last 90 days, weekly for older
        const sampled = dailyValues.filter((dv, i) => {
          if (i < 90) return true // daily for last 90 days
          return i % 7 === 0 // weekly for older
        })

        if (sampled.length > 0) {
          // Batch insert in chunks of 100
          for (let i = 0; i < sampled.length; i += 100) {
            const chunk = sampled.slice(i, i + 100)
            await supabase
              .from('portfolio_daily_values')
              .upsert(chunk, { onConflict: 'account_id,date' })
          }
          totalDailyValues += sampled.length
        }
      }
    }

    return new Response(
      JSON.stringify({
        investment_transactions: totalTransactions,
        daily_values_computed: totalDailyValues,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
