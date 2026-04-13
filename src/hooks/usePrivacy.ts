import { useState, useCallback } from 'react'

// Privacy mode: hides dollar amounts on mobile by default
// Tap to reveal, auto-hides after 5 seconds

const HIDE_DELAY = 5000

export function usePrivacy() {
  const [revealed, setRevealed] = useState(false)

  const toggle = useCallback(() => {
    setRevealed((prev) => {
      if (!prev) {
        // Auto-hide after delay
        setTimeout(() => setRevealed(false), HIDE_DELAY)
      }
      return !prev
    })
  }, [])

  const mask = useCallback((value: string) => {
    if (revealed) return value
    // Replace digits with bullet characters, keep $ and commas
    return value.replace(/[\d]/g, '•')
  }, [revealed])

  return { revealed, toggle, mask }
}
