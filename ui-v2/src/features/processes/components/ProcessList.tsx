/**
 * ProcessList 组件
 * 进程列表
 */
import { useTranslation } from 'react-i18next'
import { Loader2, Inbox } from 'lucide-react'
import { ProcessCard } from './ProcessCard'
import type { ProcessState } from '../types'

interface ProcessListProps {
  processes: ProcessState[]
  isLoading: boolean
  actionLoading: Record<string, string | null>
  onRestart: (id: string) => void
  onStop: (id: string) => void
  onStart: (id: string) => void
  onViewDetails: (id: string) => void
  onViewLogs: (id: string) => void
}

export function ProcessList({
  processes,
  isLoading,
  actionLoading,
  onRestart,
  onStop,
  onStart,
  onViewDetails,
  onViewLogs,
}: ProcessListProps) {
  const { t } = useTranslation()

  if (isLoading && processes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (processes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Inbox className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('processes.empty.noProcesses')}</p>
        <p className="text-sm mt-1">{t('processes.empty.description')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {processes.map((process) => (
        <ProcessCard
          key={process.id}
          process={process}
          isActionLoading={!!actionLoading[process.id]}
          currentAction={actionLoading[process.id] || null}
          onRestart={onRestart}
          onStop={onStop}
          onStart={onStart}
          onViewDetails={onViewDetails}
          onViewLogs={onViewLogs}
        />
      ))}
    </div>
  )
}
