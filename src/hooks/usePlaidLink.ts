import { useState, useCallback } from 'react'
import { usePlaidLink as usePlaidLinkLib } from 'react-plaid-link'
import { supabase } from '../lib/supabase'

export function usePlaidLink(onSuccess?: () => void) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const createLinkToken = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-link-token')
      if (error) throw error
      // Store token so OAuthReturn page can use it after redirect
      localStorage.setItem('plaid_link_token', data.link_token)
      // Store this app's origin so oauth-return.html knows where to redirect back
      localStorage.setItem('mani_app_origin', window.location.origin)
      setLinkToken(data.link_token)
    } catch (err) {
      console.error('Failed to create link token:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const { open, ready } = usePlaidLinkLib({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        await supabase.functions.invoke('exchange-token', {
          body: {
            public_token: publicToken,
            institution: metadata.institution,
          },
        })
        onSuccess?.()
      } catch (err) {
        console.error('Failed to exchange token:', err)
      }
    },
  })

  return { createLinkToken, open, ready: ready && !!linkToken, loading }
}
