import { useState, useCallback } from 'react'

// Privacy mode: hides dollar amounts on mobile by default
// Tap to toggle reveal on/off

export function usePrivacy() {
  const [revealed, setRevealed] = useState(false)

  const toggle = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  const mask = useCallback((value: string) => {
    if (revealed) return value
    // Replace digits with bullet characters, keep $ and commas
    return value.replace(/[\d]/g, 'X')
  }, [revealed])

  return { revealed, toggle, mask }
}
