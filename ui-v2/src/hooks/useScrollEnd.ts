/**
 * useScrollEnd hook
 * 检测滚动容器是否滚动到底部
 *
 * @example
 * ```tsx
 * function InfiniteList() {
 *   const { ref, isAtEnd } = useScrollEnd({
 *     threshold: 100,
 *     onScrollEnd: () => loadMore(),
 *   })
 *
 *   return (
 *     <div ref={ref} className="overflow-auto h-96">
 *       {items.map(item => <Item key={item.id} {...item} />)}
 *       {isAtEnd && <LoadingSpinner />}
 *     </div>
 *   )
 * }
 * ```
 */
import { useRef, useState, useEffect, useCallback } from 'react'

export interface UseScrollEndOptions {
  /** 触发阈值（距离底部多少像素时触发），默认 100 */
  threshold?: number
  /** 滚动到底部时的回调 */
  onScrollEnd?: () => void
  /** 是否禁用 */
  disabled?: boolean
}

export interface UseScrollEndResult<T extends HTMLElement = HTMLElement> {
  /** 绑定到滚动容器的 ref */
  ref: React.RefObject<T>
  /** 是否已滚动到底部 */
  isAtEnd: boolean
  /** 手动检查是否到底部 */
  checkScrollEnd: () => void
}

/**
 * 滚动到底部检测 hook
 */
export function useScrollEnd<T extends HTMLElement = HTMLElement>(
  options: UseScrollEndOptions = {}
): UseScrollEndResult<T> {
  const { threshold = 100, onScrollEnd, disabled = false } = options

  const ref = useRef<T>(null)
  const [isAtEnd, setIsAtEnd] = useState(false)
  const onScrollEndRef = useRef(onScrollEnd)

  // 保持回调引用最新
  useEffect(() => {
    onScrollEndRef.current = onScrollEnd
  }, [onScrollEnd])

  // 检查是否滚动到底部
  const checkScrollEnd = useCallback(() => {
    const element = ref.current
    if (!element) return

    const offset = element.scrollHeight - element.clientHeight - element.scrollTop
    const atEnd = offset <= threshold

    setIsAtEnd(atEnd)

    if (atEnd && onScrollEndRef.current) {
      onScrollEndRef.current()
    }
  }, [threshold])

  // 滚动事件处理
  useEffect(() => {
    const element = ref.current
    if (!element || disabled) return

    const handleScroll = () => {
      checkScrollEnd()
    }

    element.addEventListener('scroll', handleScroll)

    // 初始检查
    checkScrollEnd()

    return () => {
      element.removeEventListener('scroll', handleScroll)
    }
  }, [disabled, checkScrollEnd])

  return {
    ref,
    isAtEnd,
    checkScrollEnd,
  }
}

export default useScrollEnd
