import { useRef, useEffect, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface AutoExpandTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

export const AutoExpandTextarea = forwardRef<HTMLTextAreaElement, AutoExpandTextareaProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null)
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef

    useEffect(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [value])

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        rows={1}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden',
          className
        )}
        {...props}
      />
    )
  }
)

AutoExpandTextarea.displayName = 'AutoExpandTextarea'
