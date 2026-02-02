// T148: 错误页面
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { AlertTriangle, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 路由错误页面
 * 用于处理路由级别的错误
 */
export function ErrorPage() {
  const error = useRouteError()

  let title = '出错了'
  let message = '发生了意外错误'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    message = error.data?.message || '请求处理失败'
  } else if (error instanceof Error) {
    message = error.message
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 bg-slate-50">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center shadow-sm">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="text-center text-lg text-slate-500">{message}</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link to="/">
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          刷新页面
        </Button>
      </div>
    </div>
  )
}

export default ErrorPage
