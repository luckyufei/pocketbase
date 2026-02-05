// T026: 侧边滑出面板组件
// T0017: 增强 Escape 键保护机制
import { useEffect, useRef, useCallback } from 'react'
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
  /** Whether to protect Escape key when focus is in input/textarea/contenteditable */
  escapeProtection?: boolean
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
 * 
 * T0017: Escape 键保护机制
 * - 默认启用 escapeProtection
 * - 当焦点在 input/textarea/contenteditable/combobox/listbox 中时，Escape 不会关闭面板
 * - 这允许用户在下拉菜单等组件中使用 Escape 关闭下拉而不是整个面板
 */
export function OverlayPanel({
  open,
  onClose,
  title,
  children,
  width = 'lg',
  position = 'right',
  className,
  escapeProtection = true,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // T0017: ESC 键关闭（带保护机制）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      // 检查是否在需要保护的元素中
      if (escapeProtection) {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT'
        const isTextarea = target.tagName === 'TEXTAREA'
        const isContentEditable = target.isContentEditable
        const isCombobox = target.closest('[role="combobox"]')
        const isListbox = target.closest('[role="listbox"]')
        const isMenu = target.closest('[role="menu"]')
        const isDialog = target.closest('[role="dialog"]') !== panelRef.current?.closest('[role="dialog"]')
        
        // 如果在这些元素中，不关闭面板
        if (isInput || isTextarea || isContentEditable || isCombobox || isListbox || isMenu || isDialog) {
          return
        }
      }
      
      onClose()
    }
  }, [open, onClose, escapeProtection])
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
            aria-label="Close"
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
