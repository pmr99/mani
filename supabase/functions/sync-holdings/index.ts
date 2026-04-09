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

function classifyAssetClass(type: string, _name: string): string {
  const t = type?.toLowerCase() || ''
  if (t === 'equity' || t === 'stock') return 'stock'
  if (t === 'etf') return 'etf'
  if (t === 'mutual fund') return 'mutual_fund'
  if (t === 'fixed income' || t === 'bond') return 'bond'
  if (t === 'cash' || t === 'cash equivalent') return 'cash'
  if (t === 'cryptocurrency') return 'crypto'
  return 'other'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    let totalHoldings = 0

    for (const item of items) {
      // Get account mapping
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, plaid_account_id, type')
        .eq('plaid_item_id', item.id)

      const investmentAccounts = (accounts || []).filter((a) => a.type === 'investment')
      if (investmentAccounts.length === 0) continue

      const accountMap = new Map(investmentAccounts.map((a) => [a.plaid_account_id, a.id]))

      try {
        const holdingsRes = await fetch(`${baseUrl}/investments/holdings/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: item.access_token,
          }),
        })
        const holdingsData = await holdingsRes.json()

        if (holdingsData.error) continue

        // Build security lookup
        const securities = new Map(
          (holdingsData.securities || []).map((s: any) => [s.security_id, s])
        )

        // Process holdings
        const rows = (holdingsData.holdings || [])
          .filter((h: any) => accountMap.has(h.account_id))
          .map((h: any) => {
            const security = securities.get(h.security_id) || {}
            return {
              account_id: accountMap.get(h.account_id),
              security_name: security.name || 'Unknown',
              ticker_symbol: security.ticker_symbol || null,
              quantity: h.quantity || 0,
              cost_basis: h.cost_basis || null,
              current_value: (h.quantity || 0) * (security.close_price || 0),
              asset_class: classifyAssetClass(security.type || '', security.name || ''),
              sector: security.sector || null,
              updated_at: new Date().toISOString(),
            }
          })

        if (rows.length > 0) {
          // Remove old holdings for these accounts
          for (const acctId of accountMap.values()) {
            await supabase.from('investment_holdings').delete().eq('account_id', acctId)
          }
          // Insert fresh holdings
          await supabase.from('investment_holdings').insert(rows)
          totalHoldings += rows.length
        }
      } catch {
        // Skip if investments endpoint not available for this item
        continue
      }
    }

    return new Response(
      JSON.stringify({ holdings_synced: totalHoldings }),
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
