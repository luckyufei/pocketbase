/**
 * CollectionDocsPanel 组件
 * API 文档面板
 */
import { useState, useMemo, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  getCollectionTabs,
  getApiEndpoint,
  getHttpMethod,
  generateCurlExample,
  generateJsExample,
  getFieldQueryParams,
  FILTER_OPERATORS,
  type DocTab,
} from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
  schema?: Array<{
    name: string
    type: string
    required?: boolean
  }>
}

interface CollectionDocsPanelProps {
  collection: Collection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectionDocsPanel({ collection, open, onOpenChange }: CollectionDocsPanelProps) {
  const [activeTab, setActiveTab] = useState('list')
  const [sdkTab, setSdkTab] = useState<'curl' | 'js'>('js')

  const tabs = useMemo(() => {
    if (!collection) return []
    return getCollectionTabs(collection.type)
  }, [collection])

  // 基础 tabs 数量（用于在 auth collection 时添加分隔线）
  // BASE_TABS 包含: list, view, create, update, delete, realtime, batch = 7 个
  const baseTabsCount = 7

  // 当集合变化时重置标签
  useMemo(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  if (!collection) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[700px] sm:w-[900px] sm:max-w-none p-0">
        <div className="flex h-full">
          {/* 左侧垂直导航 */}
          <aside className="w-44 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm">API 文档</h2>
              <p className="text-xs text-muted-foreground mt-1 truncate">{collection.name}</p>
            </div>
            <ScrollArea className="flex-1">
              <nav className="p-2 space-y-1">
                {tabs.map((tab, index) => (
                  <div key={tab.id}>
                    {/* 在 auth collection 的基础 tabs 和认证 tabs 之间添加分隔线 */}
                    {collection.type === 'auth' && index === baseTabsCount && (
                      <hr className="my-2 border-border" />
                    )}
                    <button
                      type="button"
                      disabled={tab.disabled}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        tab.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {tab.label}
                    </button>
                  </div>
                ))}
              </nav>
            </ScrollArea>
          </aside>

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col min-w-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="text-base">
                {tabs.find((t) => t.id === activeTab)?.label || 'API 文档'}
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
              <ApiDocContent
                collection={collection}
                action={activeTab}
                sdkTab={sdkTab}
                onSdkTabChange={setSdkTab}
              />
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// API 文档内容
interface ApiDocContentProps {
  collection: Collection
  action: string
  sdkTab: 'curl' | 'js'
  onSdkTabChange: (tab: 'curl' | 'js') => void
}

function ApiDocContent({ collection, action, sdkTab, onSdkTabChange }: ApiDocContentProps) {
  const endpoint = getApiEndpoint(collection.name, action)
  const method = getHttpMethod(action)
  const curlExample = generateCurlExample(collection.name, action, method)
  const jsExample = generateJsExample(collection.name, action)
  const queryParams = action === 'list' ? getFieldQueryParams() : []

  return (
    <div className="space-y-6">
      {/* 端点信息 */}
      <div>
        <h3 className="text-sm font-medium mb-2">API 端点</h3>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-bold',
              method === 'GET' && 'bg-blue-100 text-blue-700',
              method === 'POST' && 'bg-green-100 text-green-700',
              method === 'PATCH' && 'bg-yellow-100 text-yellow-700',
              method === 'DELETE' && 'bg-red-100 text-red-700'
            )}
          >
            {method}
          </span>
          <span className="flex-1">{endpoint}</span>
          <CopyButton value={endpoint} />
        </div>
      </div>

      {/* 查询参数 (仅 list) */}
      {queryParams.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">查询参数</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">参数</th>
                  <th className="text-left p-2 font-medium">类型</th>
                  <th className="text-left p-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {queryParams.map((param) => (
                  <tr key={param.name} className="border-t">
                    <td className="p-2 font-mono text-xs">{param.name}</td>
                    <td className="p-2 text-muted-foreground">{param.type}</td>
                    <td className="p-2">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 过滤语法 (仅 list) */}
      {action === 'list' && (
        <div>
          <h3 className="text-sm font-medium mb-2">过滤语法</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {FILTER_OPERATORS.slice(0, 8).map((op) => (
              <div key={op.operator} className="flex items-center gap-2">
                <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{op.operator}</code>
                <span className="text-muted-foreground">{op.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SDK 示例 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">代码示例</h3>
          <div className="flex gap-1">
            <Button
              variant={sdkTab === 'js' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onSdkTabChange('js')}
            >
              JavaScript
            </Button>
            <Button
              variant={sdkTab === 'curl' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onSdkTabChange('curl')}
            >
              cURL
            </Button>
          </div>
        </div>
        <div className="relative">
          <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm font-mono">
            {sdkTab === 'js' ? jsExample : curlExample}
          </pre>
          <CopyButton
            value={sdkTab === 'js' ? jsExample : curlExample}
            className="absolute top-2 right-2"
          />
        </div>
      </div>

      {/* 字段列表 */}
      {collection.schema && collection.schema.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">字段</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">字段名</th>
                  <th className="text-left p-2 font-medium">类型</th>
                  <th className="text-left p-2 font-medium">必填</th>
                </tr>
              </thead>
              <tbody>
                {collection.schema.map((field) => (
                  <tr key={field.name} className="border-t">
                    <td className="p-2 font-mono text-xs">{field.name}</td>
                    <td className="p-2 text-muted-foreground">{field.type}</td>
                    <td className="p-2">
                      {field.required ? (
                        <span className="text-red-500">是</span>
                      ) : (
                        <span className="text-muted-foreground">否</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// 复制按钮
interface CopyButtonProps {
  value: string
  className?: string
}

function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [value])

  return (
    <Button variant="ghost" size="icon" className={cn('h-6 w-6', className)} onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}
