/**
 * 集合更新确认对话框
 * 用于确认集合更新操作，展示变更内容
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { CollectionsDiffTable } from './CollectionsDiffTable'
import type { CollectionModel } from 'pocketbase'

interface CollectionUpdateConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalCollection: CollectionModel
  updatedCollection: CollectionModel
  onConfirm: () => void
  isSubmitting?: boolean
}

export function CollectionUpdateConfirm({
  open,
  onOpenChange,
  originalCollection,
  updatedCollection,
  onConfirm,
  isSubmitting = false,
}: CollectionUpdateConfirmProps) {
  // 检查是否有字段被删除
  const originalFields = originalCollection.fields || []
  const updatedFields = updatedCollection.fields || []
  const deletedFields = originalFields.filter((f) => !updatedFields.find((uf) => uf.id === f.id))

  const hasDeletedFields = deletedFields.length > 0

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>确认集合更新</DialogTitle>
          <DialogDescription>请检查以下变更内容，确认后将应用更新</DialogDescription>
        </DialogHeader>

        {hasDeletedFields && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-bold">警告：以下字段将被删除！</p>
              <p>删除字段将永久删除所有相关数据，此操作不可撤销。</p>
              <ul className="list-disc list-inside mt-2">
                {deletedFields.map((field) => (
                  <li key={field.id}>
                    <strong>{field.name}</strong> ({field.type})
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <CollectionsDiffTable
          collectionA={originalCollection}
          collectionB={updatedCollection}
          deleteMissing={true}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant={hasDeletedFields ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? '更新中...' : '确认更新'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
