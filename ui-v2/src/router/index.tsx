/**
 * 路由配置 - T141: 使用 React.lazy 实现路由级代码分割
 */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from './ProtectedRoute'
import { RouteLoading } from './RouteLoading'

// 核心页面 - 直接导入（首屏加载）
import Login from '@/pages/Login'
import Collections from '@/pages/Collections'
import NotFound from '@/pages/NotFound'

// 懒加载页面 - 从 features 目录导入
const RecordsPage = lazy(() =>
  import('@/features/records/components/RecordsPage').then((m) => ({ default: m.RecordsPage }))
)
const LogsPage = lazy(() =>
  import('@/features/logs/components/LogsPage').then((m) => ({ default: m.LogsPage }))
)
const MonitoringPage = lazy(() =>
  import('@/features/monitoring/components/MonitoringPage').then((m) => ({
    default: m.MonitoringPage,
  }))
)
const TracesPage = lazy(() =>
  import('@/features/traces/components/TracesPage').then((m) => ({ default: m.TracesPage }))
)
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/components/AnalyticsPage').then((m) => ({
    default: m.AnalyticsPage,
  }))
)
const InstallerPage = lazy(() =>
  import('@/features/installer/components/InstallerPage').then((m) => ({
    default: m.InstallerPage,
  }))
)

// 设置页面懒加载
const SettingsLayout = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsLayout }))
)
const Application = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Application })))
const Mail = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Mail })))
const Storage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Storage })))
const Backups = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Backups })))
const Admins = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Admins })))
const Export = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Export })))
const Import = lazy(() => import('@/pages/settings').then((m) => ({ default: m.Import })))
const Jobs = lazy(() => import('@/pages/settings/Jobs'))
const Processes = lazy(() => import('@/pages/settings/Processes'))

// 认证相关页面
const RequestPasswordReset = lazy(() => import('@/pages/RequestPasswordReset'))
const ConfirmPasswordReset = lazy(() => import('@/pages/ConfirmPasswordReset'))
const ConfirmVerification = lazy(() => import('@/pages/auth/ConfirmVerification'))
const ConfirmEmailChange = lazy(() => import('@/pages/auth/ConfirmEmailChange'))
const OAuth2RedirectSuccess = lazy(() => import('@/pages/auth/OAuth2RedirectSuccess'))
const OAuth2RedirectFailure = lazy(() => import('@/pages/auth/OAuth2RedirectFailure'))

// Suspense 包装器
function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  // 登录页面（无需认证）
  {
    path: '/login',
    element: <Login />,
  },

  // 密码重置页面（无需认证）
  {
    path: '/request-password-reset',
    element: withSuspense(RequestPasswordReset),
  },
  {
    path: '/confirm-password-reset/:token',
    element: withSuspense(ConfirmPasswordReset),
  },

  // 用户认证确认页面（无需认证）
  {
    path: '/auth/confirm-verification/:token',
    element: withSuspense(ConfirmVerification),
  },
  {
    path: '/auth/confirm-email-change/:token',
    element: withSuspense(ConfirmEmailChange),
  },
  {
    path: '/auth/oauth2-redirect-success',
    element: withSuspense(OAuth2RedirectSuccess),
  },
  {
    path: '/auth/oauth2-redirect-failure',
    element: withSuspense(OAuth2RedirectFailure),
  },

  // 安装页面（无需认证）
  {
    path: '/pbinstall/:token',
    element: withSuspense(InstallerPage),
  },

  // 需要认证的路由
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      // 默认重定向到 Collections
      {
        index: true,
        element: <Navigate to="/collections" replace />,
      },

      // Collections 和 Records - 核心功能
      {
        path: 'collections',
        element: <Collections />,
        children: [
          {
            index: true,
            element: (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                请选择一个 Collection
              </div>
            ),
          },
          {
            path: ':collectionId',
            element: withSuspense(RecordsPage),
          },
        ],
      },

      // Logs - 懒加载
      {
        path: 'logs',
        element: withSuspense(LogsPage),
      },

      // Monitoring - 懒加载
      {
        path: 'monitoring',
        element: withSuspense(MonitoringPage),
      },

      // Traces - 懒加载
      {
        path: 'traces',
        element: withSuspense(TracesPage),
      },

      // Analytics - 懒加载
      {
        path: 'analytics',
        element: withSuspense(AnalyticsPage),
      },

      // Settings - 懒加载
      {
        path: 'settings',
        element: withSuspense(SettingsLayout),
        children: [
          {
            index: true,
            element: <Navigate to="/settings/application" replace />,
          },
          {
            path: 'application',
            element: withSuspense(Application),
          },
          {
            path: 'mail',
            element: withSuspense(Mail),
          },
          {
            path: 'storage',
            element: withSuspense(Storage),
          },
          {
            path: 'backups',
            element: withSuspense(Backups),
          },
          {
            path: 'crons',
            element: (
              <div className="p-6">
                <h2 className="text-lg font-semibold">Cron Jobs</h2>
                <p className="text-muted-foreground mt-2">待实现</p>
              </div>
            ),
          },
          {
            path: 'secrets',
            element: (
              <div className="p-6">
                <h2 className="text-lg font-semibold">Secrets</h2>
                <p className="text-muted-foreground mt-2">待实现</p>
              </div>
            ),
          },
          {
            path: 'analytics',
            element: (
              <div className="p-6">
                <h2 className="text-lg font-semibold">Analytics Settings</h2>
                <p className="text-muted-foreground mt-2">待实现</p>
              </div>
            ),
          },
          {
            path: 'admins',
            element: withSuspense(Admins),
          },
          {
            path: 'tokens',
            element: (
              <div className="p-6">
                <h2 className="text-lg font-semibold">Tokens</h2>
                <p className="text-muted-foreground mt-2">待实现</p>
              </div>
            ),
          },
          {
            path: 'export',
            element: withSuspense(Export),
          },
          {
            path: 'import',
            element: withSuspense(Import),
          },
          {
            path: 'jobs',
            element: withSuspense(Jobs),
          },
          {
            path: 'processes',
            element: withSuspense(Processes),
          },
        ],
      },

      // 404
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

export default router
