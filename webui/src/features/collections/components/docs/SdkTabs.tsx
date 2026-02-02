/**
 * SdkTabs 组件
 * SDK 代码示例标签页
 */
import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SdkTabsProps {
  js: string
  dart?: string
  curl?: string
  className?: string
}

export function SdkTabs({ js, dart, curl, className }: SdkTabsProps) {
  const [activeTab, setActiveTab] = useState('js')
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const code = activeTab === 'js' ? js : activeTab === 'dart' ? dart : curl || ''
    try {
      await navigator.clipboard.writeText(code.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [activeTab, js, dart, curl])

  const tabs = [
    { id: 'js', label: 'JavaScript', code: js },
    ...(dart ? [{ id: 'dart', label: 'Dart', code: dart }] : []),
    ...(curl ? [{ id: 'curl', label: 'cURL', code: curl }] : []),
  ]

  return (
    <div className={cn('relative', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-8">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs px-3 h-7">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm font-mono max-h-[300px]">
              <code>{tab.code.trim()}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
