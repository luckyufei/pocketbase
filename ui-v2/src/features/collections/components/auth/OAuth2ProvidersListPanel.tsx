/**
 * OAuth2ProvidersListPanel 组件
 * OAuth2 提供商列表面板
 */
import { useState, useMemo } from 'react'
import { Settings, Check, X, ChevronRight, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  OAUTH2_PROVIDERS,
  getProviderDisplayName,
  isProviderConfigured,
  type ProviderConfig,
} from '@/lib/providers'

interface OAuth2ProvidersListPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: Record<string, ProviderConfig>
  onProviderSelect: (providerName: string) => void
}

export function OAuth2ProvidersListPanel({
  open,
  onOpenChange,
  providers,
  onProviderSelect,
}: OAuth2ProvidersListPanelProps) {
  const [search, setSearch] = useState('')

  const filteredProviders = useMemo(() => {
    if (!search.trim()) return OAUTH2_PROVIDERS
    const query = search.toLowerCase()
    return OAUTH2_PROVIDERS.filter(
      (p) => p.name.toLowerCase().includes(query) || p.displayName.toLowerCase().includes(query)
    )
  }, [search])

  const configuredCount = useMemo(() => {
    return Object.values(providers).filter(isProviderConfigured).length
  }, [providers])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            OAuth2 提供商
            {configuredCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {configuredCount} 已配置
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索提供商..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 提供商列表 */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-1">
              {filteredProviders.map((provider) => {
                const config = providers[provider.name]
                const configured = isProviderConfigured(config)
                const enabled = config?.enabled !== false

                return (
                  <button
                    key={provider.name}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                      'hover:bg-muted',
                      configured && 'bg-muted/50'
                    )}
                    onClick={() => onProviderSelect(provider.name)}
                  >
                    {/* 图标 */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold',
                        configured
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {provider.displayName.charAt(0)}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{provider.displayName}</span>
                        {configured && (
                          <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
                            {enabled ? '已启用' : '已禁用'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{provider.name}</p>
                    </div>

                    {/* 状态图标 */}
                    <div className="flex items-center gap-2">
                      {configured ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                )
              })}

              {filteredProviders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">没有找到匹配的提供商</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
