/**
 * LogViewPanel 组件
 * 日志详情面板
 */
import { useMemo, useCallback } from 'react'
import { Download, Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LogLevel } from './LogLevel'
import { LogDate } from './LogDate'
import type { LogEntry } from '../store'
import { extractSortedDataKeys, isEmpty, downloadLogAsJson } from '@/lib/logUtils'
import { useState } from 'react'

interface LogViewPanelProps {
  log: LogEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading?: boolean
}

export function LogViewPanel({ log, open, onOpenChange, isLoading = false }: LogViewPanelProps) {
  const isRequest = log?.data?.type === 'request'
  const dataKeys = useMemo(() => (log?.data ? extractSortedDataKeys(log.data) : []), [log?.data])

  const handleDownload = useCallback(() => {
    if (log) {
      downloadLogAsJson(log)
    }
  }, [log])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>日志详情</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : log ? (
          <ScrollArea className="max-h-[60vh]">
            <table className="w-full border-collapse">
              <tbody>
                {/* ID */}
                <DetailRow label="id" value={log.id} />

                {/* Level */}
                <tr className="border-b">
                  <td className="py-3 pr-4 text-sm font-medium text-muted-foreground w-[120px]">
                    level
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-between">
                      <LogLevel level={log.level} />
                      <CopyButton value={String(log.level)} />
                    </div>
                  </td>
                </tr>

                {/* Created */}
                <tr className="border-b">
                  <td className="py-3 pr-4 text-sm font-medium text-muted-foreground">created</td>
                  <td className="py-3">
                    <div className="flex items-center justify-between">
                      <LogDate date={log.created} />
                      <CopyButton value={log.created} />
                    </div>
                  </td>
                </tr>

                {/* Message (非请求类型) */}
                {!isRequest && <DetailRow label="message" value={log.message} />}

                {/* Data 字段 */}
                {dataKeys.map((key) => {
                  const value = log.data[key]
                  const isEmptyValue = isEmpty(value)
                  const isJson = !isEmptyValue && value !== null && typeof value === 'object'

                  return (
                    <tr key={key} className="border-b">
                      <td
                        className={cn(
                          'py-3 pr-4 text-sm font-medium text-muted-foreground',
                          isJson && 'align-top'
                        )}
                      >
                        data.{key}
                      </td>
                      <td className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          {isEmptyValue ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : isJson ? (
                            <pre className="text-sm bg-muted p-2 rounded overflow-auto max-w-full">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : key === 'error' ? (
                            <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {String(value)}
                            </span>
                          ) : key === 'details' ? (
                            <pre className="text-sm bg-muted p-2 rounded overflow-auto max-w-full whitespace-pre-wrap">
                              {String(value)}
                            </pre>
                          ) : (
                            <span className="text-sm">
                              {String(value)}
                              {isRequest && key === 'execTime' ? 'ms' : ''}
                            </span>
                          )}
                          {!isEmptyValue && (
                            <CopyButton
                              value={
                                typeof value === 'object' ? JSON.stringify(value) : String(value)
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
          <Button onClick={handleDownload} disabled={isLoading || !log}>
            <Download className="mr-2 h-4 w-4" />
            下载 JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 详情行组件
interface DetailRowProps {
  label: string
  value: string | undefined
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <tr className="border-b">
      <td className="py-3 pr-4 text-sm font-medium text-muted-foreground w-[120px]">{label}</td>
      <td className="py-3">
        <div className="flex items-center justify-between">
          {value ? (
            <span className="text-sm">{value}</span>
          ) : (
            <span className="text-sm text-muted-foreground">N/A</span>
          )}
          {value && <CopyButton value={value} />}
        </div>
      </td>
    </tr>
  )
}

// 复制按钮组件
interface CopyButtonProps {
  value: string
}

function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [value])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}
