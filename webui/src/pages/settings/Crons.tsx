/**
 * Crons Settings 页面
 * Cron 任务管理
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw, Play, Loader2 } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'

interface CronJob {
  id: string
  expression: string
}

export function Crons() {
  const [crons, setCrons] = useState<CronJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({})

  const pb = getApiClient()

  const loadCrons = async () => {
    setIsLoading(true)
    try {
      // 使用 crons API 获取所有 cron 任务
      const result = await pb.send('/api/crons', { method: 'GET' })
      setCrons(result || [])
    } catch (err: any) {
      if (!err?.isAbort) {
        console.error('Failed to load crons:', err)
        setCrons([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const runCron = async (jobId: string) => {
    setIsRunning(prev => ({ ...prev, [jobId]: true }))
    try {
      await pb.send(`/api/crons/${encodeURIComponent(jobId)}`, { method: 'POST' })
      toast.success(`Successfully triggered ${jobId}.`)
    } catch (err: any) {
      if (!err?.isAbort) {
        console.error('Failed to run cron:', err)
        toast.error(`Failed to trigger ${jobId}.`)
      }
    } finally {
      setIsRunning(prev => ({ ...prev, [jobId]: false }))
    }
  }

  useEffect(() => {
    loadCrons()
  }, [])

  return (
    <div className="p-6 max-w-4xl">
      {/* 页面标题 */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Crons</span>
        </nav>
      </header>

      {/* 主面板 */}
      <div className="border rounded-lg bg-card">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 p-4 pb-2">
          <span className="text-xl">Registered app cron jobs</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadCrons}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Cron 列表 */}
        <div className="divide-y">
          {isLoading ? (
            // 加载状态 - skeleton loader
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-5 flex-1" />
                </div>
              ))}
            </>
          ) : crons.length === 0 ? (
            // 空状态
            <div className="px-4 py-6 text-center text-muted-foreground">
              No app crons found.
            </div>
          ) : (
            // Cron 列表
            crons.map((cron) => (
              <div key={cron.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{cron.id}</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">
                  {cron.expression}
                </span>
                <div className="flex items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => runCron(cron.id)}
                          disabled={isRunning[cron.id]}
                        >
                          {isRunning[cron.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Run</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <p className="px-4 py-3 text-sm text-muted-foreground border-t">
          App cron jobs can be registered only programmatically with{' '}
          <a
            href="https://pocketbase.io/docs/go-jobs-scheduling/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Go
          </a>{' '}
          or{' '}
          <a
            href="https://pocketbase.io/docs/js-jobs-scheduling/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            JavaScript
          </a>.
        </p>
      </div>
    </div>
  )
}

export default Crons
