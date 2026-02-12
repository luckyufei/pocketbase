/**
 * T0015: Ctrl+S 快捷键 Hook
 * 实现 Ctrl/Cmd+S 保存快捷键
 */
import { useEffect, useCallback } from 'react'

interface UseCtrlSOptions {
  /** 是否启用快捷键 */
  enabled?: boolean
}

/**
 * Hook: Ctrl/Cmd+S 保存快捷键
 * @param onSave 保存回调函数
 * @param options 配置选项
 */
export function useCtrlS(onSave: () => void, options: UseCtrlSOptions = {}) {
  const { enabled = true } = options

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopPropagation()
        onSave()
      }
    },
    [onSave]
  )

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

export default useCtrlS
