import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { format } from 'date-fns'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { collectionsAtom } from '@/store/collections'
import type { RecordModel } from 'pocketbase'

interface AutodateIconProps {
  record: RecordModel
}

const DETAILED_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss.SSS'

export function AutodateIcon({ record }: AutodateIconProps) {
  const collections = useAtomValue(collectionsAtom)
  
  const tooltipDates = useMemo(() => {
    const collection = collections.find(c => c.id === record.collectionId)
    if (!collection) return []
    
    // Use fields from collection (may be stored as schema in some versions)
    const fields = (collection as any).fields || (collection as any).schema || []
    
    return fields
      .filter((f: any) => f.type === 'autodate')
      .map((field: any) => {
        const dateValue = record[field.name]
        if (!dateValue) return null
        const localDate = format(new Date(dateValue as string), DETAILED_DATE_FORMAT)
        return `${field.name}: ${localDate} Local`
      })
      .filter(Boolean) as string[]
  }, [record, collections])
  
  if (tooltipDates.length === 0) return null
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <i className="ri-calendar-event-line txt-disabled cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="left">
        <pre className="text-xs whitespace-pre-wrap">
          {tooltipDates.join('\n')}
        </pre>
      </TooltipContent>
    </Tooltip>
  )
}
