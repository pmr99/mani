import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Get all depository (cash) accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, current_balance, available_balance, name, type')
      .eq('type', 'depository')

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No cash accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalDailyValues = 0

    for (const acct of accounts) {
      const currentBalance = acct.current_balance || 0

      // Get all transactions for this account, sorted by date descending
      const { data: txns } = await supabase
        .from('transactions')
        .select('amount, date')
        .eq('account_id', acct.id)
        .order('date', { ascending: false })

      const transactions = txns || []

      // Build a map of net transaction amounts by date
      // Plaid: positive = money out (expense), negative = money in (income/deposit)
      const txnsByDate = new Map<string, number>()
      for (const t of transactions) {
        const existing = txnsByDate.get(t.date) || 0
        txnsByDate.set(t.date, existing + t.amount)
      }

      // Walk backwards from current balance
      // If today we spent $50 (amount=50), yesterday we had $50 more
      // If today we received $100 (amount=-100), yesterday we had $100 less
      const dailyValues: { account_id: string; date: string; value: number }[] = []
      let runningBalance = currentBalance
      const today = new Date()
      const lookbackDays = 730 // 2 years

      for (let i = 0; i <= lookbackDays; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]

        dailyValues.push({
          account_id: acct.id,
          date: dateStr,
          value: Math.round(runningBalance * 100) / 100,
        })

        // Reverse this day's transactions to get previous day's balance
        const dayNet = txnsByDate.get(dateStr)
        if (dayNet !== undefined) {
          // dayNet positive = spent money, so yesterday we had more
          // dayNet negative = received money, so yesterday we had less
          runningBalance += dayNet
        }
      }

      // Sample: daily for last 90 days, weekly for older
      const sampled = dailyValues.filter((_, i) => {
        if (i < 90) return true
        return i % 7 === 0
      })

      // Batch upsert
      for (let i = 0; i < sampled.length; i += 100) {
        const chunk = sampled.slice(i, i + 100)
        await supabase
          .from('cash_daily_values')
          .upsert(chunk, { onConflict: 'account_id,date' })
      }
      totalDailyValues += sampled.length
    }

    return new Response(
      JSON.stringify({ daily_values_computed: totalDailyValues, accounts: accounts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
