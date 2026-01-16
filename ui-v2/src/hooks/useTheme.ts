/**
 * 主题切换 Hook
 */
import { useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'pocketbase-theme'

/**
 * 获取系统主题偏好
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 获取实际应用的主题
 */
function getAppliedTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

/**
 * 主题切换 Hook
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
  })

  const [appliedTheme, setAppliedTheme] = useState<'light' | 'dark'>(() => {
    return getAppliedTheme(theme)
  })

  // 应用主题到 DOM
  const applyTheme = useCallback((newTheme: Theme) => {
    const applied = getAppliedTheme(newTheme)
    setAppliedTheme(applied)

    const root = document.documentElement
    if (applied === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [])

  // 设置主题
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme)
      localStorage.setItem(THEME_KEY, newTheme)
      applyTheme(newTheme)
    },
    [applyTheme]
  )

  // 切换主题
  const toggleTheme = useCallback(() => {
    const newTheme = appliedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }, [appliedTheme, setTheme])

  // 初始化和监听系统主题变化
  useEffect(() => {
    applyTheme(theme)

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme])

  return {
    theme,
    appliedTheme,
    setTheme,
    toggleTheme,
    isDark: appliedTheme === 'dark',
  }
}
