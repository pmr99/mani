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
    const { public_token, institution } = await req.json()
    const baseUrl = PLAID_BASE_URL[PLAID_ENV]

    // Exchange public token for access token
    const exchangeRes = await fetch(`${baseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    })
    const { access_token, item_id } = await exchangeRes.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Store the plaid item
    const { data: plaidItem } = await supabase
      .from('plaid_items')
      .insert({
        access_token,
        institution_id: institution?.institution_id || item_id,
        institution_name: institution?.name || 'Unknown',
      })
      .select()
      .single()

    // Fetch accounts from Plaid
    const accountsRes = await fetch(`${baseUrl}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    })
    const accountsData = await accountsRes.json()

    // Store accounts in database
    const accountRows = accountsData.accounts.map((acct: any) => ({
      plaid_item_id: plaidItem!.id,
      plaid_account_id: acct.account_id,
      name: acct.name,
      type: acct.type,
      subtype: acct.subtype,
      mask: acct.mask,
      current_balance: acct.balances.current,
      available_balance: acct.balances.available,
    }))

    await supabase.from('accounts').insert(accountRows)

    return new Response(
      JSON.stringify({ success: true, accounts: accountRows.length }),
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
