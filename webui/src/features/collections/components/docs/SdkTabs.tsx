/**
 * SdkTabs component
 * SDK code examples with tabs (JavaScript + Dart)
 */
import { useState, useCallback, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CodeBlock } from './CodeBlock'

const SDK_PREFERENCE_KEY = 'pb_sdk_preference'
const PB_JS_SDK_URL = 'https://github.com/pocketbase/js-sdk'
const PB_DART_SDK_URL = 'https://github.com/pocketbase/dart-sdk'

interface SdkTabsProps {
  js: string
  dart: string
  className?: string
}

type SdkLanguage = 'javascript' | 'dart'

export function SdkTabs({ js, dart, className }: SdkTabsProps) {
  const [activeTab, setActiveTab] = useState<SdkLanguage>(() => {
    const stored = localStorage.getItem(SDK_PREFERENCE_KEY)
    return (stored === 'javascript' || stored === 'dart') ? stored : 'javascript'
  })
  const [copied, setCopied] = useState(false)

  // Store user preference when tab changes
  useEffect(() => {
    localStorage.setItem(SDK_PREFERENCE_KEY, activeTab)
  }, [activeTab])

  const sdkExamples = [
    {
      id: 'javascript' as const,
      title: 'JavaScript',
      language: 'javascript' as const,
      code: js,
      url: PB_JS_SDK_URL,
    },
    {
      id: 'dart' as const,
      title: 'Dart',
      language: 'dart' as const,
      code: dart,
      url: PB_DART_SDK_URL,
    },
  ]

  const handleCopy = useCallback(async () => {
    const code = activeTab === 'javascript' ? js : dart
    try {
      await navigator.clipboard.writeText(code.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [activeTab, js, dart])

  return (
    <div className={cn('sdk-tabs', className)}>
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-0">
          {sdkExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => setActiveTab(example.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px min-w-[100px]',
                activeTab === example.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {example.title}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {sdkExamples.map((example) => (
        <div
          key={example.id}
          className={cn(activeTab === example.id ? 'block' : 'hidden')}
        >
          <CodeBlock content={example.code} language={example.language} showCopy={false} />
          <div className="text-right mt-1">
            <em className="text-sm text-muted-foreground">
              <a
                href={example.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {example.title} SDK
              </a>
            </em>
          </div>
        </div>
      ))}
    </div>
  )
}
