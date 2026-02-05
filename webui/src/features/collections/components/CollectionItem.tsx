// T046: Collection 列表项组件
import { memo } from 'react'
import { Database, Users, Eye, MoreVertical, Pencil, Trash2, Pin, PinOff } from 'lucide-react'
import type { CollectionModel } from 'pocketbase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TextTooltip, IconTooltip } from '@/components/ui/text-tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CollectionItemProps {
  collection: CollectionModel
  isActive?: boolean
  isPinned?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onTogglePin?: () => void
}

const typeIcons = {
  base: Database,
  auth: Users,
  view: Eye,
}

// 统一使用 slate 灰色系，不再区分类型颜色
const typeColors = {
  base: 'text-slate-500',
  auth: 'text-slate-500',
  view: 'text-slate-500',
}

/**
 * Collection 列表项组件
 * 使用 React.memo 优化渲染性能
 */
export const CollectionItem = memo(function CollectionItem({
  collection,
  isActive = false,
  isPinned = false,
  onClick,
  onEdit,
  onDelete,
  onTogglePin,
}: CollectionItemProps) {
  const Icon = typeIcons[collection.type as keyof typeof typeIcons] || Database
  const colorClass = typeColors[collection.type as keyof typeof typeColors] || 'text-slate-500'

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-500' : colorClass)} />
      <TextTooltip text={collection.name} className="flex-1 text-sm" side="right" />

      {/* Pin 按钮 */}
      <IconTooltip content={isPinned ? 'Unpin collection' : 'Pin collection'} side="right">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 opacity-0 group-hover:opacity-40 hover:!opacity-100',
            isActive && 'text-blue-600 hover:bg-blue-100'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin?.()
          }}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
      </IconTooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6 opacity-0 group-hover:opacity-100',
              isActive && 'text-blue-600 hover:bg-blue-100'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
})

export default CollectionItem
