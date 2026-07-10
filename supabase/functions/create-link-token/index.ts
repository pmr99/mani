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
    // If a plaid_item_id is passed, this is an UPDATE MODE token (for reconnecting stale items)
    let updateAccessToken: string | undefined
    let institutionName: string | undefined
    if (req.body) {
      try {
        const reqBody = await req.json()
        if (reqBody?.plaid_item_id) {
          const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          const { data: item } = await sb.from('plaid_items').select('access_token, institution_name').eq('id', reqBody.plaid_item_id).single()
          if (item?.access_token && item.access_token !== 'csv-import') {
            updateAccessToken = item.access_token
            institutionName = item.institution_name
          }
        }
      } catch { /* no body — normal flow */ }
    }

    const body: any = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: { client_user_id: 'personal-user' },
      client_name: 'Mani',
      country_codes: ['US'],
      language: 'en',
      redirect_uri: PLAID_ENV === 'production' ? 'https://www.pradeepmanirathnam.com/oauth-return.html' : undefined,
    }

    if (updateAccessToken) {
      // Update mode: pass access_token, NO products (Plaid derives from existing item)
      body.access_token = updateAccessToken
      console.log('[create-link-token] UPDATE MODE for:', institutionName)
    } else {
      // Normal mode: new link
      body.products = ['transactions']
      body.required_if_supported_products = ['investments']
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
