import { useState, useCallback } from 'react'
import { usePlaidLink as usePlaidLinkLib } from 'react-plaid-link'
import { supabase } from '../lib/supabase'

export function usePlaidLink(onSuccess?: () => void) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isUpdateMode, setIsUpdateMode] = useState(false)

  const createLinkToken = useCallback(async () => {
    setLoading(true)
    setIsUpdateMode(false)
    try {
      const { data, error } = await supabase.functions.invoke('create-link-token')
      if (error) throw error
      localStorage.setItem('plaid_link_token', data.link_token)
      localStorage.setItem('mani_app_origin', window.location.origin)
      setLinkToken(data.link_token)
    } catch (err) {
      console.error('Failed to create link token:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Update-mode token for reconnecting a stale item (ITEM_LOGIN_REQUIRED)
  const createUpdateLinkToken = useCallback(async (plaidItemId: string) => {
    setLoading(true)
    setIsUpdateMode(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-link-token', {
        body: { plaid_item_id: plaidItemId },
      })
      if (error) throw error
      localStorage.setItem('plaid_link_token', data.link_token)
      localStorage.setItem('mani_app_origin', window.location.origin)
      setLinkToken(data.link_token)
    } catch (err) {
      console.error('Failed to create update link token:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const { open, ready } = usePlaidLinkLib({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      // Update mode: no need to exchange — same access token remains valid.
      // Just trigger a refresh so the UI clears the error state.
      if (isUpdateMode) {
        try {
          await supabase.functions.invoke('refresh-balances')
        } catch { /* non-fatal */ }
        onSuccess?.()
        return
      }
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

  return { createLinkToken, createUpdateLinkToken, open, ready: ready && !!linkToken, loading, isUpdateMode }
}
