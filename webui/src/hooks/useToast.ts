/**
 * useToast hook - Toast notification system
 * Simple wrapper for toast notifications
 */
import { useState, useCallback } from 'react'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

export interface Toast extends ToastOptions {
  id: string
  open: boolean
}

let toastCount = 0

// Global toast state for simple usage
const listeners: Set<(toast: Toast) => void> = new Set()
const toasts: Map<string, Toast> = new Map()

function addToast(options: ToastOptions): string {
  const id = String(++toastCount)
  const toast: Toast = {
    ...options,
    id,
    open: true,
  }
  toasts.set(id, toast)
  listeners.forEach((listener) => listener(toast))

  // Auto dismiss after duration
  const duration = options.duration || 5000
  setTimeout(() => {
    dismissToast(id)
  }, duration)

  return id
}

function dismissToast(id: string) {
  const toast = toasts.get(id)
  if (toast) {
    toast.open = false
    toasts.delete(id)
    listeners.forEach((listener) => listener({ ...toast, open: false }))
  }
}

/**
 * Hook for using toast notifications
 */
export function useToast() {
  const [, setUpdate] = useState(0)

  const toast = useCallback((options: ToastOptions) => {
    const id = addToast(options)
    setUpdate((u) => u + 1)
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    dismissToast(id)
    setUpdate((u) => u + 1)
  }, [])

  return {
    toast,
    dismiss,
    toasts: Array.from(toasts.values()),
  }
}

export default useToast
