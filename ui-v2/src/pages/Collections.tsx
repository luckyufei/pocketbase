/**
 * Collections 页面
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import { setPageTitle } from '@/store/app'
import { CollectionsSidebar } from '@/features/collections/components/Sidebar'
import { Outlet } from 'react-router-dom'

export function Collections() {
  const { t } = useTranslation()
  const setTitle = useSetAtom(setPageTitle)

  useEffect(() => {
    setTitle(t('collections.title', 'Collections'))
  }, [setTitle, t])

  return (
    <div className="flex h-full">
      {/* Collections 侧边栏 */}
      <CollectionsSidebar />

      {/* Records 内容区域 */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

export default Collections
