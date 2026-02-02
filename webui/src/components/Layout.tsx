/**
 * 主布局组件
 * 包含侧边栏和内容区域
 * T143: 添加键盘导航支持
 */
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toasts } from './Toasts'
import { Confirmation } from './Confirmation'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

export function Layout() {
  // 启用全局键盘导航
  useKeyboardNavigation()

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* 全局 Toast */}
      <Toasts />

      {/* 全局确认对话框 */}
      <Confirmation />
    </div>
  )
}

export default Layout
