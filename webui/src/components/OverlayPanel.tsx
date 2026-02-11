// T026: 侧边滑出面板组件
// T0017: 增强 Escape 键保护机制
import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { allocateZIndex, releaseZIndex, generatePanelId } from '@/lib/zIndexManager'

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
  /** Extra content to render in the header (e.g., action buttons) */
  headerExtra?: React.ReactNode
  /** Fixed footer content (e.g., action buttons) */
  footer?: React.ReactNode
  /** Whether ESC key closes the panel (default: true) */
  escClose?: boolean
  /** Whether clicking overlay closes the panel (default: true) */
  overlayClose?: boolean
  /** Show loading indicator in header */
  loading?: boolean
  /** Custom z-index for nested panels (default: 50) */
  zIndex?: number
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
  headerExtra,
  footer,
  escClose = true,
  overlayClose = true,
  loading = false,
  zIndex,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  
  // 动态 z-index 管理
  const [panelId] = useState(() => generatePanelId())
  const [dynamicZIndex, setDynamicZIndex] = useState(zIndex ?? 50)

  // 当面板打开/关闭时，分配/释放 z-index
  // 如果传入了 zIndex prop，则使用传入的值；否则动态分配
  useEffect(() => {
    if (open) {
      if (zIndex !== undefined) {
        // 使用传入的 z-index（用于嵌套面板场景）
        setDynamicZIndex(zIndex)
      } else {
        // 动态分配，确保后打开的面板总是在最上层
        const allocated = allocateZIndex(panelId)
        setDynamicZIndex(allocated)
      }
    } else {
      if (zIndex === undefined) {
        releaseZIndex(panelId)
      }
    }
    
    return () => {
      if (open && zIndex === undefined) {
        releaseZIndex(panelId)
      }
    }
  }, [open, panelId, zIndex])

  // 当面板打开时，自动聚焦到面板，确保可以与面板内容交互
  // 这对于嵌套在其他模态对话框中的情况尤为重要，可以突破焦点陷阱
  useEffect(() => {
    if (open && panelRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        panelRef.current?.focus()
      })
    }
  }, [open])

  // T0017: ESC 键关闭（带保护机制）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 只处理 Escape 键
    if (e.key !== 'Escape' || !open || !escClose) {
      return
    }
    
    // 检查是否在需要保护的元素中
    if (escapeProtection) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT'
      const isTextarea = target.tagName === 'TEXTAREA'
      const isContentEditable = target.isContentEditable
      const isCombobox = target.closest('[role="combobox"]')
      const isListbox = target.closest('[role="listbox"]')
      const isMenu = target.closest('[role="menu"]')
      const isDialog = target.closest('[role=\"dialog\"]') !== panelRef.current?.closest('[role=\"dialog\"]')
      // CodeMirror 编辑器
      const isCodeMirror = target.closest('.cm-editor')
      
      // 如果在这些元素中，不关闭面板
      if (isInput || isTextarea || isContentEditable || isCombobox || isListbox || isMenu || isDialog || isCodeMirror) {
        return
      }
    }
    
    onClose()
  }, [open, onClose, escapeProtection, escClose])
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  // 使用 Portal 渲染到 body 下，确保与其他模态对话框（如 DialogPrimitive.Portal）在同一层级
  // 这样 z-index 可以正确比较，解决嵌套面板的层级问题
  // 背景遮罩和面板内容作为兄弟元素渲染，避免事件拦截问题
  return createPortal(
    <>
      {/* 背景遮罩 - 独立元素，不包含面板内容 */}
      {/* 使用 pointer-events: none 让点击可以穿透到底层面板 */}
      {/* 这解决了多层面板嵌套时，底层遮罩阻止与上层面板交互的问题 */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        style={{ 
          zIndex: dynamicZIndex,
          pointerEvents: 'none'
        }}
        aria-hidden="true"
      />
      {/* 面板内容 - 作为兄弟元素，不受背景遮罩事件影响 */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 h-full bg-background shadow-xl transition-transform duration-300 flex flex-col',
          widthClasses[width],
          position === 'right' ? 'right-0' : 'left-0',
          className
        )}
        style={{ zIndex: dynamicZIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'overlay-panel-title' : undefined}
        // 使面板可聚焦，这样可以突破其他模态对话框的焦点陷阱
        tabIndex={-1}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {title && (
              <h2 id="overlay-panel-title" className="text-lg font-semibold">
                {title}
              </h2>
            )}
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {headerExtra}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}

export default OverlayPanel
