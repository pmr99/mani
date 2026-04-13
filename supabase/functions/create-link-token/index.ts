import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'

const PLAID_BASE_URL: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: { client_user_id: 'personal-user' },
      client_name: 'Mani',
      products: ['transactions'],
      optional_products: ['investments'],
      required_if_supported_products: ['investments'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: PLAID_ENV === 'production' ? 'https://www.pradeepmanirathnam.com/oauth-return.html' : undefined,
    }

    console.log('[create-link-token] env:', PLAID_ENV, '| redirect_uri:', body.redirect_uri ?? 'none')

    const response = await fetch(`${PLAID_BASE_URL[PLAID_ENV]}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok || data.error_code) {
      console.error('[create-link-token] Plaid error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data.error_message || 'Plaid error', plaid: data }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[create-link-token] success, token prefix:', data.link_token?.slice(0, 20))

    return new Response(JSON.stringify({ link_token: data.link_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[create-link-token] exception:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
