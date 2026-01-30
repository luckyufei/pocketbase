/**
 * ProcessDetails 组件
 * 进程详情侧边栏
 */
import { useTranslation } from 'react-i18next'
import { Clock, Hash, RefreshCw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ProcessState } from '../types'

interface ProcessDetailsProps {
  process: ProcessState | null
  open: boolean
  onClose: () => void
}

export function ProcessDetails({ process, open, onClose }: ProcessDetailsProps) {
  const { t } = useTranslation()

  const statusConfig = {
    running: {
      label: t('processes.status.running'),
      className: 'bg-green-500 hover:bg-green-600',
    },
    stopped: {
      label: t('processes.status.stopped'),
      className: 'bg-slate-400 hover:bg-slate-500',
    },
    crashed: {
      label: t('processes.status.crashed'),
      className: 'bg-red-500 hover:bg-red-600',
    },
    starting: {
      label: t('processes.status.starting'),
      className: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  }

  if (!process) return null

  const config = statusConfig[process.status] || statusConfig.stopped

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="font-mono">{process.id}</span>
            <Badge className={cn(config.className)}>{config.label}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 基本信息 */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('processes.details.basicInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                icon={<Hash className="h-4 w-4" />}
                label={t('processes.details.pid')}
                value={process.pid > 0 ? String(process.pid) : '-'}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4" />}
                label={t('processes.details.uptime')}
                value={process.uptime || '-'}
              />
              <InfoItem
                icon={<RefreshCw className="h-4 w-4" />}
                label={t('processes.details.restartCount')}
                value={String(process.restartCount)}
              />
              <InfoItem
                icon={<Clock className="h-4 w-4" />}
                label={t('processes.details.status')}
                value={config.label}
              />
            </div>
          </section>

          {/* 错误信息 */}
          {process.lastError && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {t('processes.details.lastError')}
              </h3>
              <div className="bg-red-50 text-red-800 rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                {process.lastError}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface InfoItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium font-mono">{value}</div>
      </div>
    </div>
  )
}
