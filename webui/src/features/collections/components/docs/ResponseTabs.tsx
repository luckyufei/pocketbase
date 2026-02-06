/**
 * ResponseTabs component
 * Displays API response examples with HTTP status code tabs
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './CodeBlock'

interface Response {
  code: number
  body: string
}

interface ResponseTabsProps {
  responses: Response[]
  className?: string
  showTabs?: boolean
}

export function ResponseTabs({ responses, className, showTabs = true }: ResponseTabsProps) {
  const [activeCode, setActiveCode] = useState(responses[0]?.code || 200)

  // If showTabs is false, just display the first response without tabs
  if (!showTabs && responses.length > 0) {
    return (
      <div className={className}>
        <CodeBlock content={responses[0].body} language="json" />
      </div>
    )
  }

  return (
    <div className={className}>
      <h4 className="text-sm font-medium mb-2">Responses</h4>
      <div className="tabs">
        <div className="flex gap-0 mb-2 border-b">
          {responses.map((response) => (
            <button
              key={response.code}
              type="button"
              onClick={() => setActiveCode(response.code)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeCode === response.code
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {response.code}
            </button>
          ))}
        </div>
        {responses.map((response) => (
          <div
            key={response.code}
            className={cn(activeCode === response.code ? 'block' : 'hidden')}
          >
            <CodeBlock content={response.body} language="json" />
          </div>
        ))}
      </div>
    </div>
  )
}
