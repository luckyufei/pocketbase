/**
 * 记录信息摘要组件
 * 用于在关联记录等场景展示记录的简要信息
 */
import { ExternalLink } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { truncate, truncateObject } from '@/lib/utils'
import { RecordInfoContent } from './RecordInfoContent'
import type { RecordModel } from 'pocketbase'

interface RecordInfoProps {
  record: RecordModel
}

function excludeProps(item: Record<string, unknown>, ...props: string[]): Record<string, unknown> {
  const result = { ...item }
  for (const prop of props) {
    delete result[prop]
  }
  return result
}

export function RecordInfo({ record }: RecordInfoProps) {
  const tooltipText = truncate(
    JSON.stringify(truncateObject(excludeProps(record, 'expand')), null, 2),
    800,
    true
  )

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex-1 min-w-0">
        <RecordInfoContent record={record} />
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`#/collections?collection=${record.collectionId}&recordId=${record.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-md">
            <pre className="text-xs whitespace-pre-wrap font-mono">{tooltipText}</pre>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
