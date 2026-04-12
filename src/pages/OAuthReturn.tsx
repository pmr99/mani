import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function OAuthReturn() {
  const navigate = useNavigate()

  // The link token was stored before the user left for the bank OAuth page
  const [linkToken] = useState(() => localStorage.getItem('plaid_link_token'))

  // Stored by oauth-return.html in sessionStorage (tab-scoped, clears on close)
  const [receivedRedirectUri] = useState(() => sessionStorage.getItem('plaid_oauth_redirect_uri'))

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
        // Clean up stored OAuth state
        localStorage.removeItem('plaid_link_token')
        sessionStorage.removeItem('plaid_oauth_redirect_uri')
      } catch (err) {
        console.error('Failed to exchange token:', err)
      }
      navigate('/accounts')
    },
    onExit: () => {
      sessionStorage.removeItem('plaid_oauth_redirect_uri')
      navigate('/accounts')
    },
  })

  useEffect(() => {
    if (!linkToken || !receivedRedirectUri) {
      // No OAuth state — stale/direct navigation, go home
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
