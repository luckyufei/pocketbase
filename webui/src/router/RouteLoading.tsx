// T015: 路由加载状态组件
import { Loader2 } from 'lucide-react'

export function RouteLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    </div>
  )
}

export default RouteLoading
