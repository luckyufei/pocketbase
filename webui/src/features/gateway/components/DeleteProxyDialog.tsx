/**
 * DeleteProxyDialog 组件
 * 删除代理确认对话框
 */
import { Loader2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <AlertDialogTitle>{t('gateway.deleteProxy')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            {t('gateway.deleteConfirmMsg')} <strong className="text-slate-900">{proxyName}</strong>?
            <br />
            <span className="text-red-600">{t('gateway.deleteWarning')}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t('gateway.cancel')}
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
                {t('gateway.deleting')}
              </>
            ) : (
              t('gateway.confirmDelete')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
