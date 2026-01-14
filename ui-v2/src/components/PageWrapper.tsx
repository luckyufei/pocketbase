// T018: 页面容器组件
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { pageTitleAtom } from '@/store/app'

interface PageWrapperProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * 页面容器组件
 * 自动设置页面标题，提供统一的页面布局
 */
export function PageWrapper({ title, children, className = '' }: PageWrapperProps) {
  const setPageTitle = useSetAtom(pageTitleAtom)

  useEffect(() => {
    if (title) {
      setPageTitle(title)
      document.title = `${title} - PocketBase`
    }
    return () => {
      setPageTitle('')
    }
  }, [title, setPageTitle])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {title && (
        <header className="h-14 px-6 border-b flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{title}</h1>
        </header>
      )}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

export default PageWrapper
