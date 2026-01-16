/**
 * T143: 键盘导航 Hook
 * 提供全局快捷键支持
 */
import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  action: () => void
  description: string
}

/**
 * 全局键盘导航 Hook
 */
export function useKeyboardNavigation() {
  const navigate = useNavigate()

  // 定义快捷键
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'g',
      alt: true,
      action: () => navigate('/collections'),
      description: 'Go to Collections',
    },
    {
      key: 'l',
      alt: true,
      action: () => navigate('/logs'),
      description: 'Go to Logs',
    },
    {
      key: 'm',
      alt: true,
      action: () => navigate('/monitoring'),
      description: 'Go to Monitoring',
    },
    {
      key: 't',
      alt: true,
      action: () => navigate('/traces'),
      description: 'Go to Traces',
    },
    {
      key: 'a',
      alt: true,
      action: () => navigate('/analytics'),
      description: 'Go to Analytics',
    },
    {
      key: 's',
      alt: true,
      action: () => navigate('/settings'),
      description: 'Go to Settings',
    },
    {
      key: '/',
      ctrl: true,
      action: () => {
        // 聚焦到搜索框
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
        searchInput?.focus()
      },
      description: 'Focus search',
    },
    {
      key: 'Escape',
      action: () => {
        // 关闭任何打开的面板或对话框
        const activeElement = document.activeElement as HTMLElement
        activeElement?.blur()
      },
      description: 'Close panel / Blur focus',
    },
  ]

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 如果在输入框中，忽略大部分快捷键
      const target = event.target as HTMLElement
      const isInputElement =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          // 对于 Escape 键，始终允许
          if (shortcut.key === 'Escape') {
            event.preventDefault()
            shortcut.action()
            return
          }

          // 对于其他快捷键，如果在输入框中则忽略
          if (!isInputElement) {
            event.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { shortcuts }
}

/**
 * 焦点陷阱 Hook
 * 用于模态框等需要限制焦点范围的场景
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    // 自动聚焦第一个元素
    firstElement?.focus()

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, isActive])
}

/**
 * 箭头键导航 Hook
 * 用于列表等需要上下键导航的场景
 */
export function useArrowNavigation(
  items: HTMLElement[] | null,
  options: {
    loop?: boolean
    onSelect?: (index: number) => void
  } = {}
) {
  const { loop = true, onSelect } = options

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!items || items.length === 0) return

      const currentIndex = items.findIndex((item) => item === document.activeElement)

      let nextIndex: number | null = null

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          if (currentIndex === -1) {
            nextIndex = 0
          } else if (currentIndex < items.length - 1) {
            nextIndex = currentIndex + 1
          } else if (loop) {
            nextIndex = 0
          }
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          if (currentIndex === -1) {
            nextIndex = items.length - 1
          } else if (currentIndex > 0) {
            nextIndex = currentIndex - 1
          } else if (loop) {
            nextIndex = items.length - 1
          }
          break

        case 'Home':
          event.preventDefault()
          nextIndex = 0
          break

        case 'End':
          event.preventDefault()
          nextIndex = items.length - 1
          break

        case 'Enter':
        case ' ':
          if (currentIndex !== -1 && onSelect) {
            event.preventDefault()
            onSelect(currentIndex)
          }
          break
      }

      if (nextIndex !== null && items[nextIndex]) {
        items[nextIndex].focus()
      }
    },
    [items, loop, onSelect]
  )

  return { handleKeyDown }
}
