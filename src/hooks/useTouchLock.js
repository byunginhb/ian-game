import { useEffect } from 'react'

/**
 * 게임 영역에서 터치 스크롤, 당겨서 새로고침, 확대/축소를 방지합니다.
 * 게임 컴포넌트에서 ref와 함께 사용:
 *
 *   const gameRef = useRef(null)
 *   useTouchLock(gameRef)
 *
 *   <div ref={gameRef} ...>
 */
export function useTouchLock(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prevent = (e) => {
      e.preventDefault()
    }

    // touchmove preventDefault로 스크롤/당겨서 새로고침 차단
    el.addEventListener('touchmove', prevent, { passive: false })

    // 전역 overscroll 방지 (게임 플레이 중 body 스크롤 차단)
    const originalOverscroll = document.body.style.overscrollBehavior
    const originalOverflow = document.body.style.overflow
    document.body.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'

    return () => {
      el.removeEventListener('touchmove', prevent)
      document.body.style.overscrollBehavior = originalOverscroll
      document.body.style.overflow = originalOverflow
    }
  }, [ref])
}
