import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function OAuthReturn() {
  const navigate = useNavigate()
  const [linkToken, setLinkToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.functions.invoke('create-link-token').then(({ data, error }) => {
      if (error) { console.error('Failed to create link token:', error); return }
      setLinkToken(data.link_token)
    })
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: window.location.href,
    onSuccess: async (publicToken, metadata) => {
      try {
        await supabase.functions.invoke('exchange-token', {
          body: {
            public_token: publicToken,
            institution: metadata.institution,
          },
        })
      } catch (err) {
        console.error('Failed to exchange token:', err)
      }
      navigate('/accounts')
    },
    onExit: () => navigate('/accounts'),
  })

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Completing bank connection...</p>
      </div>
    </div>
  )
}
