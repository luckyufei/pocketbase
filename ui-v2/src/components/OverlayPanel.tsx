// T026: 侧边滑出面板组件
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OverlayPanelProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  position?: 'left' | 'right'
  className?: string
}

const widthClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[480px]',
  xl: 'w-[640px]',
  full: 'w-full max-w-2xl',
}

/**
 * 侧边滑出面板组件
 * 用于编辑表单、详情展示等场景
 */
export function OverlayPanel({
  open,
  onClose,
  title,
  children,
  width = 'lg',
  position = 'right',
  className,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 点击遮罩关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 transition-opacity"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'overlay-panel-title' : undefined}
    >
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 h-full bg-background shadow-xl transition-transform duration-300',
          widthClasses[width],
          position === 'right' ? 'right-0' : 'left-0',
          className
        )}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b flex items-center justify-between">
          {title && (
            <h2 id="overlay-panel-title" className="text-lg font-semibold">
              {title}
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-auto"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-56px)] overflow-auto p-4">{children}</div>
      </div>
    </div>
  )
}

export default OverlayPanel
