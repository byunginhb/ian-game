import { useEffect } from 'react'

/** Prevent native image dragging without locking the page or scrollable menus. */
export function useTouchLock(ref) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const preventDrag = (event) => event.preventDefault()
    element.addEventListener('dragstart', preventDrag)
    return () => element.removeEventListener('dragstart', preventDrag)
  }, [ref])
}
