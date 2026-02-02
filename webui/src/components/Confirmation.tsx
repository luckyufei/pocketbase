/**
 * 确认对话框组件
 */
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { confirmationAtom, hideConfirmation } from '@/store/confirmation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Confirmation() {
  const { t } = useTranslation()
  const confirmation = useAtomValue(confirmationAtom)
  const hide = useSetAtom(hideConfirmation)

  if (!confirmation) {
    return null
  }

  const handleConfirm = () => {
    confirmation.onConfirm()
    hide()
  }

  const handleCancel = () => {
    confirmation.onCancel?.()
    hide()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />

      {/* 对话框 */}
      <div className="relative bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold text-foreground mb-2">{confirmation.title}</h2>
        <p className="text-muted-foreground mb-6">{confirmation.message}</p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            {confirmation.cancelText || t('common.cancel', '取消')}
          </Button>
          <Button
            variant={confirmation.isDanger ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmation.confirmText || t('common.confirm', '确定')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Confirmation
