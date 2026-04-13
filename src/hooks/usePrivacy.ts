import { useState, useCallback, createContext, useContext } from 'react'

// Privacy mode: hides dollar amounts on mobile by default
// Tap to toggle reveal on/off

interface PrivacyContext {
  revealed: boolean
  toggle: () => void
  mask: (value: string) => string
}

const PrivacyCtx = createContext<PrivacyContext>({ revealed: false, toggle: () => {}, mask: (v) => v })

export function usePrivacy() {
  return useContext(PrivacyCtx)
}

export function usePrivacyProvider() {
  const [revealed, setRevealed] = useState(false)

  const toggle = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  const mask = useCallback((value: string) => {
    if (revealed) return value
    return value.replace(/[\d]/g, 'X')
  }, [revealed])

  return { revealed, toggle, mask, Provider: PrivacyCtx.Provider }
}
