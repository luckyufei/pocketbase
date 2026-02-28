/**
 * Crons Settings 页面
 * Cron 任务管理
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      toast.success(t('settingsPage.crons.triggerSuccess', { jobId }))
    } catch (err: any) {
      if (!err?.isAbort) {
        console.error('Failed to run cron:', err)
        toast.error(t('settingsPage.crons.triggerError', { jobId }))
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
      {/* Page header */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>{t('settingsPage.breadcrumbSettings')}</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{t('settingsPage.crons.breadcrumb')}</span>
        </nav>
      </header>

      {/* Main panel */}
      <div className="border rounded-lg bg-card">
        {/* Title bar */}
        <div className="flex items-center gap-2 p-4 pb-2">
          <span className="text-xl">{t('settingsPage.crons.title')}</span>
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
              <TooltipContent>{t('settingsPage.crons.refresh')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Cron list */}
        <div className="divide-y">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-5 flex-1" />
                </div>
              ))}
            </>
          ) : crons.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted-foreground">
              {t('settingsPage.crons.noCrons')}
            </div>
          ) : (
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
                      <TooltipContent>{t('settingsPage.crons.run')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom hint */}
        <p className="px-4 py-3 text-sm text-muted-foreground border-t">
          {t('settingsPage.crons.hint')}{' '}
          <a
            href="https://pocketbase.io/docs/go-jobs-scheduling/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Go
          </a>{' '}
          {t('settingsPage.crons.hintOr')}{' '}
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
