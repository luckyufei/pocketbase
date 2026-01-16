/**
 * Toast 通知组件
 */
import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { toastsAtom, removeToast, type Toast, type ToastType } from '@/store/toasts'
import { cn } from '@/lib/utils'

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
}

const bgColors: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
  warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
  info: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
}

interface ToastItemProps {
  toast: Toast
}

function ToastItem({ toast }: ToastItemProps) {
  const remove = useSetAtom(removeToast)

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        remove(toast.id)
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, remove])

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        bgColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>
      <button
        onClick={() => remove(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useAtomValue(toastsAtom)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export default Toasts
