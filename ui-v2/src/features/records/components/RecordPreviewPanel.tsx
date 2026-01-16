/**
 * RecordPreviewPanel - 记录预览面板
 * 用于在对话框中预览记录详情
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { pb } from '@/lib/ApiClient'

interface RecordField {
  name: string
  type: string
  required?: boolean
  hidden?: boolean
}

interface Collection {
  id: string
  name: string
  type: 'base' | 'auth' | 'view'
  fields: RecordField[]
}

interface RecordPreviewPanelProps {
  open: boolean
  onClose: () => void
  collection: Collection
  recordId: string
}

export function RecordPreviewPanel({
  open,
  onClose,
  collection,
  recordId,
}: RecordPreviewPanelProps) {
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasEditorField = collection.fields.some((f) => f.type === 'editor')

  // 加载记录
  const loadRecord = useCallback(async () => {
    if (!recordId || !collection.id) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await pb.collection(collection.id).getOne(recordId)
      setRecord(result)
    } catch (err: any) {
      console.error('Failed to load record:', err)
      setError(err.message || 'Failed to load record')
    } finally {
      setIsLoading(false)
    }
  }, [recordId, collection.id])

  useEffect(() => {
    if (open && recordId) {
      loadRecord()
    } else {
      setRecord(null)
      setError(null)
    }
  }, [open, recordId, loadRecord])

  // 格式化字段值
  const formatFieldValue = (field: RecordField, value: any): string => {
    if (value === null || value === undefined) return '-'

    switch (field.type) {
      case 'bool':
        return value ? 'Yes' : 'No'
      case 'json':
        return JSON.stringify(value, null, 2)
      case 'date':
        return new Date(value).toLocaleString()
      case 'file':
        return Array.isArray(value) ? value.join(', ') : value
      case 'relation':
        return Array.isArray(value) ? value.join(', ') : value
      case 'select':
        return Array.isArray(value) ? value.join(', ') : value
      default:
        return String(value)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={hasEditorField ? 'max-w-4xl' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>
            <strong>{collection.name}</strong> record preview
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-8">{error}</div>
        ) : record ? (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full">
              <tbody>
                {collection.fields
                  .filter((f) => !f.hidden)
                  .map((field) => (
                    <tr key={field.name} className="border-b last:border-b-0">
                      <td className="px-4 py-2 bg-muted/50 font-medium text-sm w-1/4">
                        {field.name}
                      </td>
                      <td className="px-4 py-2 text-sm break-all">
                        {field.type === 'editor' ? (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: record[field.name] || '' }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans">
                            {formatFieldValue(field, record[field.name])}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">No record to display</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
