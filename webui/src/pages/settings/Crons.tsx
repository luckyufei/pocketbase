/**
 * Crons Settings 页面
 * Cron 任务管理
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, Play, Pause } from 'lucide-react'
import { getApiClient } from '@/lib/ApiClient'

interface CronJob {
  id: string
  name: string
  expression: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

export function Crons() {
  const [crons, setCrons] = useState<CronJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const pb = getApiClient()

  const loadCrons = async () => {
    setIsLoading(true)
    try {
      // 使用 settings API 获取 cron 配置
      const settings = await pb.send('/api/settings', { method: 'GET' })
      // 解析 cron 设置（如果存在）
      const cronJobs: CronJob[] = settings?.crons || []
      setCrons(cronJobs)
    } catch (err) {
      console.error('Failed to load crons:', err)
      setCrons([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCrons()
  }, [])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

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

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <Button variant="outline" onClick={loadCrons} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Cron 列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : crons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No cron jobs configured.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Expression</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crons.map((cron) => (
              <TableRow key={cron.id}>
                <TableCell className="font-medium">{cron.name}</TableCell>
                <TableCell className="font-mono text-sm">{cron.expression}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      cron.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {cron.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(cron.lastRun)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(cron.nextRun)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" title={cron.enabled ? 'Disable' : 'Enable'}>
                    {cron.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export default Crons
