/**
 * DeleteProxyDialog 组件
 * 删除代理确认对话框
 */
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface DeleteProxyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proxyName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteProxyDialog({
  open,
  onOpenChange,
  proxyName,
  onConfirm,
  isDeleting,
}: DeleteProxyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <AlertDialogTitle>确认删除代理</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            您确定要删除代理 <strong className="text-slate-900">{proxyName}</strong> 吗？
            <br />
            <span className="text-red-600">此操作无法撤销，所有相关配置将被永久删除。</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                删除中...
              </>
            ) : (
              '确认删除'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
