/**
 * 路由守卫组件
 * 用于保护需要认证的路由
 */
import { Navigate, useLocation } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { isAuthenticatedAtom } from '@/store/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * 保护路由，未认证时重定向到登录页
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const location = useLocation()

  if (!isAuthenticated) {
    // 保存当前位置，登录后重定向回来
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
