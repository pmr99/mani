import { useState, useEffect } from 'react'
import { isFreeMode, setFreeMode as setFreeModeStorage } from '../lib/freeMode'

// Reactive hook for free mode — re-renders when toggled
export function useFreeMode() {
  const [free, setFree] = useState(isFreeMode())

  function toggle() {
    const newVal = !free
    setFreeModeStorage(newVal)
    setFree(newVal)
  }

  return { isFree: free, toggle, setMode: (v: boolean) => { setFreeModeStorage(v); setFree(v) } }
}
