/**
 * LogViewPanel 组件
 * 日志详情面板 - Apple 风格侧边滑动面板
 * 与 UI 版本对齐
 */
import { useMemo, useCallback, useState } from 'react'
import { Download, Copy, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LogLevel } from './LogLevel'
import { LogDate } from './LogDate'
import type { LogEntry } from '../store'
import { extractSortedDataKeys, isEmpty, downloadLogAsJson } from '@/lib/logUtils'

interface LogViewPanelProps {
  log: LogEntry | null
  onClose: () => void
}

export function LogViewPanel({ log, onClose }: LogViewPanelProps) {
  const isRequest = log?.data?.type === 'request'
  const dataKeys = useMemo(() => (log?.data ? extractSortedDataKeys(log.data) : []), [log?.data])

  const handleDownload = useCallback(() => {
    if (log) {
      downloadLogAsJson(log)
    }
  }, [log])

  return (
    <div
      className={`fixed right-0 top-0 h-full w-[420px] bg-white border-l border-slate-200 shadow-xl transform transition-transform duration-300 ease-out z-50 ${
        log ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {log && (
        <div className="h-full flex flex-col">
          {/* 面板头部 */}
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-900">Log Details</span>
              <LogLevel level={log.level} />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                title="Download as JSON"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 面板内容 */}
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <tbody>
                {/* ID */}
                <DetailRow label="id" value={log.id} mono />

                {/* Level */}
                <tr className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="py-3 px-4 text-xs font-medium text-slate-500 w-[100px] align-top">
                    level
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <LogLevel level={log.level} />
                      <CopyButton value={String(log.level)} />
                    </div>
                  </td>
                </tr>

                {/* Created */}
                <tr className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="py-3 px-4 text-xs font-medium text-slate-500 align-top">
                    created
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <LogDate date={log.created} />
                      <CopyButton value={log.created} />
                    </div>
                  </td>
                </tr>

                {/* Message */}
                <DetailRow
                  label="message"
                  value={log.message}
                  mono
                  wrap
                />

                {/* Data 字段 */}
                {dataKeys.map((key) => {
                  const value = log.data[key]
                  const isEmptyValue = isEmpty(value)
                  const isJson = !isEmptyValue && value !== null && typeof value === 'object'
                  const isError = key === 'error'
                  const isDetails = key === 'details'

                  return (
                    <tr key={key} className="border-b border-slate-100 hover:bg-slate-50 group">
                      <td className="py-3 px-4 text-xs font-medium text-slate-500 align-top">
                        data.{key}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          {isEmptyValue ? (
                            <span className="text-xs text-slate-400">N/A</span>
                          ) : isJson ? (
                            <pre className="text-xs font-mono bg-slate-100 p-2 rounded-lg overflow-auto max-w-full max-h-[200px] text-slate-700">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : isError ? (
                            <span className="inline-flex items-center rounded px-2 py-1 text-xs bg-red-50 text-red-600 font-medium">
                              {String(value)}
                            </span>
                          ) : isDetails ? (
                            <pre className="text-xs font-mono bg-slate-100 p-2 rounded-lg overflow-auto max-w-full whitespace-pre-wrap text-slate-700">
                              {String(value)}
                            </pre>
                          ) : (
                            <span className="text-sm text-slate-700">
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
          </div>
        </div>
      )}
    </div>
  )
}

// 详情行组件
interface DetailRowProps {
  label: string
  value: string | undefined
  mono?: boolean
  wrap?: boolean
}

function DetailRow({ label, value, mono, wrap }: DetailRowProps) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 group">
      <td className="py-3 px-4 text-xs font-medium text-slate-500 w-[100px] align-top">
        {label}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          {value ? (
            <span
              className={cn(
                'text-sm text-slate-700',
                mono && 'font-mono text-xs',
                wrap && 'break-all'
              )}
            >
              {value}
            </span>
          ) : (
            <span className="text-xs text-slate-400">N/A</span>
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
      size="sm"
      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0 text-slate-400 hover:text-slate-600"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}
