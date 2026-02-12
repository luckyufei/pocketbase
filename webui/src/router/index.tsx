/**
 * 路由配置 - 扁平化路由结构
 * 所有页面直接挂载在根路由下，通过侧边栏分组导航
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

// Gateway 页面懒加载
const ProxyListPage = lazy(() =>
  import('@/features/gateway/components/ProxyListPage').then((m) => ({
    default: m.ProxyListPage,
  }))
)
const ProxyDetailPage = lazy(() =>
  import('@/features/gateway/components/ProxyDetailPage').then((m) => ({
    default: m.ProxyDetailPage,
  }))
)

// Settings Layout
const SettingsLayout = lazy(() => import('@/pages/settings/Layout'))

// 设置页面懒加载
const Application = lazy(() => import('@/pages/settings/Application'))
const Mail = lazy(() => import('@/pages/settings/Mail'))
const Storage = lazy(() => import('@/pages/settings/Storage'))
const Backups = lazy(() => import('@/pages/settings/Backups'))
const Admins = lazy(() => import('@/pages/settings/Admins'))
const Export = lazy(() => import('@/pages/settings/Export'))
const Import = lazy(() => import('@/pages/settings/Import'))
const Crons = lazy(() => import('@/pages/settings/Crons'))
const Secrets = lazy(() => import('@/pages/settings/Secrets'))
const Jobs = lazy(() => import('@/pages/settings/Jobs'))
const AnalyticsSettings = lazy(() => import('@/pages/settings/AnalyticsSettings'))
const Tokens = lazy(() => import('@/pages/settings/Tokens'))

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

export const router = createBrowserRouter(
  [
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

    // 需要认证的路由（扁平化结构）
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

        // ========== Data ==========
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

        // ========== Observability ==========
        {
          path: 'logs',
          element: withSuspense(LogsPage),
        },
        {
          path: 'monitoring',
          element: withSuspense(MonitoringPage),
        },
        {
          path: 'traces',
          element: withSuspense(TracesPage),
        },
        {
          path: 'analytics',
          element: withSuspense(AnalyticsPage),
        },

        // ========== Settings (嵌套路由，使用独立侧边栏) ==========
        {
          path: 'settings',
          element: withSuspense(SettingsLayout),
          children: [
            // 默认重定向到 Application
            {
              index: true,
              element: <Navigate to="/settings/application" replace />,
            },
            // System
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
            // Operations
            {
              path: 'crons',
              element: withSuspense(Crons),
            },
            {
              path: 'jobs',
              element: withSuspense(Jobs),
            },
            {
              path: 'secrets',
              element: withSuspense(Secrets),
            },
            // Security
            {
              path: 'admins',
              element: withSuspense(Admins),
            },
            {
              path: 'tokens',
              element: withSuspense(Tokens),
            },
            {
              path: 'analytics-settings',
              element: withSuspense(AnalyticsSettings),
            },
            // Infrastructure - Gateway
            {
              path: 'gateway',
              element: withSuspense(ProxyListPage),
            },
            {
              path: 'gateway/new',
              element: withSuspense(ProxyDetailPage),
            },
            {
              path: 'gateway/:id',
              element: withSuspense(ProxyDetailPage),
            },
            // Sync
            {
              path: 'export',
              element: withSuspense(Export),
            },
            {
              path: 'import',
              element: withSuspense(Import),
            },
          ],
        },

        // 兼容旧的扁平路由（重定向到新的 /settings/* 路由）
        {
          path: 'gateway',
          element: <Navigate to="/settings/gateway" replace />,
        },
        {
          path: 'gateway/new',
          element: <Navigate to="/settings/gateway/new" replace />,
        },
        {
          path: 'gateway/:id',
          element: <Navigate to="/settings/gateway/:id" replace />,
        },
        {
          path: 'application',
          element: <Navigate to="/settings/application" replace />,
        },
        {
          path: 'mail',
          element: <Navigate to="/settings/mail" replace />,
        },
        {
          path: 'storage',
          element: <Navigate to="/settings/storage" replace />,
        },
        {
          path: 'backups',
          element: <Navigate to="/settings/backups" replace />,
        },
        {
          path: 'crons',
          element: <Navigate to="/settings/crons" replace />,
        },
        {
          path: 'jobs',
          element: <Navigate to="/settings/jobs" replace />,
        },
        {
          path: 'secrets',
          element: <Navigate to="/settings/secrets" replace />,
        },
        {
          path: 'admins',
          element: <Navigate to="/settings/admins" replace />,
        },
        {
          path: 'export',
          element: <Navigate to="/settings/export" replace />,
        },
        {
          path: 'import',
          element: <Navigate to="/settings/import" replace />,
        },
        {
          path: 'tokens',
          element: <Navigate to="/settings/tokens" replace />,
        },
        {
          path: 'analytics-settings',
          element: <Navigate to="/settings/analytics-settings" replace />,
        },

        // 404
        {
          path: '*',
          element: <NotFound />,
        },
      ],
    },
  ],
  {
    // 开发模式用 '/'，生产模式用 '/_'
    basename: import.meta.env.DEV ? '/' : '/_',
  }
)

export default router
