import { useState } from 'react'
import { isFreeMode, setFreeMode as setFreeModeStorage } from '../lib/freeMode'

// Reactive hook for free mode — reloads page on toggle to update all components
export function useFreeMode() {
  const [free] = useState(isFreeMode())

  function setMode(v: boolean) {
    setFreeModeStorage(v)
    window.location.reload()
  }

  return { isFree: free, toggle: () => setMode(!free), setMode }
}
