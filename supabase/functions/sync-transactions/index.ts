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
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const baseUrl = PLAID_BASE_URL[PLAID_ENV]

    // Get all plaid items
    const { data: items } = await supabase.from('plaid_items').select('*')
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No linked accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalAdded = 0
    let totalModified = 0
    let totalRemoved = 0

    for (const item of items) {
      // Get account ID mapping
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, plaid_account_id')
        .eq('plaid_item_id', item.id)

      const accountMap = new Map(
        (accounts || []).map((a) => [a.plaid_account_id, a.id])
      )

      let hasMore = true
      let cursor = item.cursor || undefined

      while (hasMore) {
        const syncRes = await fetch(`${baseUrl}/transactions/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: item.access_token,
            cursor,
          }),
        })
        const syncData = await syncRes.json()

        // Handle added transactions
        if (syncData.added?.length > 0) {
          const rows = syncData.added
            .filter((t: any) => accountMap.has(t.account_id))
            .map((t: any) => ({
              account_id: accountMap.get(t.account_id),
              plaid_transaction_id: t.transaction_id,
              amount: t.amount,
              date: t.date,
              name: t.name,
              merchant_name: t.merchant_name,
              category: t.personal_finance_category?.primary || t.category?.[0] || null,
              pending: t.pending,
            }))

          if (rows.length > 0) {
            await supabase
              .from('transactions')
              .upsert(rows, { onConflict: 'plaid_transaction_id' })
            totalAdded += rows.length
          }
        }

        // Handle modified transactions
        if (syncData.modified?.length > 0) {
          for (const t of syncData.modified) {
            await supabase
              .from('transactions')
              .update({
                amount: t.amount,
                date: t.date,
                name: t.name,
                merchant_name: t.merchant_name,
                category: t.personal_finance_category?.primary || t.category?.[0] || null,
                pending: t.pending,
              })
              .eq('plaid_transaction_id', t.transaction_id)
            totalModified++
          }
        }

        // Handle removed transactions
        if (syncData.removed?.length > 0) {
          const removedIds = syncData.removed.map((t: any) => t.transaction_id)
          await supabase
            .from('transactions')
            .delete()
            .in('plaid_transaction_id', removedIds)
          totalRemoved += removedIds.length
        }

        hasMore = syncData.has_more
        cursor = syncData.next_cursor
      }

      // Update cursor and last_synced_at
      await supabase
        .from('plaid_items')
        .update({ cursor, last_synced_at: new Date().toISOString() })
        .eq('id', item.id)

      // Refresh account balances
      const balancesRes = await fetch(`${baseUrl}/accounts/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: item.access_token,
        }),
      })
      const balancesData = await balancesRes.json()

      for (const acct of balancesData.accounts || []) {
        await supabase
          .from('accounts')
          .update({
            current_balance: acct.balances.current,
            available_balance: acct.balances.available,
            updated_at: new Date().toISOString(),
          })
          .eq('plaid_account_id', acct.account_id)
      }
    }

    // Capture net worth snapshot
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
      const totalAssets = cashBal + investBal
      const totalLiabilities = creditBal + loanBal
      const today = new Date().toISOString().split('T')[0]

      await supabase.from('net_worth_snapshots').upsert({
        snapshot_date: today,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: totalAssets - totalLiabilities,
        cash_balance: cashBal,
        investment_balance: investBal,
        credit_balance: creditBal,
        loan_balance: loanBal,
      }, { onConflict: 'snapshot_date' })
    }

    return new Response(
      JSON.stringify({ added: totalAdded, modified: totalModified, removed: totalRemoved }),
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
