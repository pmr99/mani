import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function OAuthReturn() {
  const navigate = useNavigate()

  // Link token stored before the user left for the bank's OAuth page
  const [linkToken] = useState(() => localStorage.getItem('plaid_link_token'))

  // receivedRedirectUri travels via URL param (sessionStorage/localStorage are domain-scoped
  // and won't cross from pradeepmanirathnam.com to localhost)
  const [receivedRedirectUri] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('uri') ? decodeURIComponent(params.get('uri')!) : null
  })

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: receivedRedirectUri ?? undefined,
    onSuccess: async (publicToken, metadata) => {
      try {
        await supabase.functions.invoke('exchange-token', {
          body: {
            public_token: publicToken,
            institution: metadata.institution,
          },
        })
        localStorage.removeItem('plaid_link_token')
      } catch (err) {
        console.error('Failed to exchange token:', err)
      }
      navigate('/accounts')
    },
    onExit: () => navigate('/accounts'),
  })

  useEffect(() => {
    if (!linkToken || !receivedRedirectUri) {
      // Missing OAuth state — stale or direct navigation, go home
      navigate('/')
      return
    }
    if (ready) open()
  }, [ready, open, linkToken, receivedRedirectUri, navigate])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Completing bank connection...</p>
      </div>
    </div>
  )
}
