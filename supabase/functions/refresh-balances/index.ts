import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This function ONLY calls /accounts/get which is FREE and UNLIMITED on Plaid.
// It refreshes balances for all linked accounts without using any paid API calls.

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

    let totalAccounts = 0
    const results: Array<{ institution: string; status: string; error?: string; error_code?: string; accounts?: number }> = []

    for (const item of items) {
      // Skip CSV-imported items — they don't have a real Plaid access token
      if (item.access_token === 'csv-import') {
        results.push({ institution: item.institution_name, status: 'skipped-csv' })
        continue
      }

      // /accounts/get is FREE — does not count against any product cap
      const res = await fetch(`${baseUrl}/accounts/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: item.access_token,
        }),
      })
      const data = await res.json()

      if (data.error_code || !res.ok) {
        console.error(`[${item.institution_name}] Plaid error: ${data.error_code} — ${data.error_message}`)
        results.push({
          institution: item.institution_name,
          status: 'error',
          error_code: data.error_code,
          error: data.error_message,
        })
        // Persist error state so the UI can flag it and offer reconnect
        await supabase
          .from('plaid_items')
          .update({
            last_synced_at: new Date().toISOString(),
            error_code: data.error_code || 'UNKNOWN',
            error_message: data.error_message || 'Unknown Plaid error',
          })
          .eq('id', item.id)
        continue
      }

      let itemAccountsUpdated = 0
      for (const acct of data.accounts || []) {
        const upd = await supabase
          .from('accounts')
          .update({
            current_balance: acct.balances.current,
            available_balance: acct.balances.available,
            updated_at: new Date().toISOString(),
          })
          .eq('plaid_account_id', acct.account_id)
          .select('id')
        if (upd.data && upd.data.length > 0) {
          itemAccountsUpdated++
          totalAccounts++
        }
      }

      results.push({
        institution: item.institution_name,
        status: 'ok',
        accounts: itemAccountsUpdated,
      })

      // Update last_synced_at and clear any prior error
      await supabase
        .from('plaid_items')
        .update({
          last_synced_at: new Date().toISOString(),
          error_code: null,
          error_message: null,
        })
        .eq('id', item.id)
    }

    // Capture net worth snapshot (also free — just reads from our own DB)
    const { data: allAccounts } = await supabase.from('accounts').select('type, current_balance')
    if (allAccounts && allAccounts.length > 0) {
      let cashBal = 0, investBal = 0, creditBal = 0, loanBal = 0
      for (const a of allAccounts) {
        const bal = a.current_balance || 0
        if (a.type === 'depository') cashBal += bal
        else if (a.type === 'investment') investBal += bal
        else if (a.type === 'credit') creditBal += bal
        else if (a.type === 'loan') loanBal += bal
      }
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('net_worth_snapshots').upsert({
        snapshot_date: today,
        total_assets: cashBal + investBal,
        total_liabilities: creditBal + loanBal,
        net_worth: (cashBal + investBal) - (creditBal + loanBal),
        cash_balance: cashBal,
        investment_balance: investBal,
        credit_balance: creditBal,
        loan_balance: loanBal,
      }, { onConflict: 'snapshot_date' })
    }

    return new Response(
      JSON.stringify({ accounts_refreshed: totalAccounts, mode: 'free', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
