// T046: Collection 列表项组件
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
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

// 统一使用 Vercel 极简风格：纯黑白灰
const typeColors = {
  base: 'text-muted-foreground',
  auth: 'text-muted-foreground',
  view: 'text-muted-foreground',
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
  const { t } = useTranslation()
  const Icon = typeIcons[collection.type as keyof typeof typeIcons] || Database
  const colorClass = typeColors[collection.type as keyof typeof typeColors] || 'text-slate-500'

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-3 py-2.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-foreground' : colorClass)} />
      <TextTooltip text={collection.name} className="flex-1 text-sm" side="right" />

      {/* Pin 按钮 */}
      <IconTooltip content={isPinned ? t('collections.unpinCollection', 'Unpin collection') : t('collections.pinCollection', 'Pin collection')} side="right">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 opacity-0 group-hover:opacity-40 hover:!opacity-100',
            isActive && 'text-foreground hover:bg-accent'
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
              isActive && 'text-foreground hover:bg-accent'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit', 'Edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            {t('common.delete', 'Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
})

export default CollectionItem
