import { useMemo } from 'react'

interface UseChangeDetectionOptions {
  original: Record<string, unknown>
  current: Record<string, unknown>
  uploadedFiles: Record<string, File[]>
  deletedFiles: Record<string, string[]>
}

interface UseChangeDetectionReturn {
  hasChanges: boolean
  hasFileChanges: boolean
  hasDataChanges: boolean
}

/**
 * 标准化值用于比较
 * 处理 JSON 字段的特殊情况：字符串和对象应该被视为等价
 */
function normalizeValue(val: unknown): unknown {
  if (val === undefined || val === null) {
    return null
  }
  // 如果是字符串，尝试解析为 JSON
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

/**
 * 深度比较两个值是否相等
 */
function deepEqual(a: unknown, b: unknown): boolean {
  const normalizedA = normalizeValue(a)
  const normalizedB = normalizeValue(b)
  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB)
}

/**
 * Hook for detecting changes between original and current form data
 */
export function useChangeDetection(options: UseChangeDetectionOptions): UseChangeDetectionReturn {
  const hasFileChanges = useMemo(() => {
    const hasUploaded = Object.values(options.uploadedFiles).some((f) => f.length > 0)
    const hasDeleted = Object.values(options.deletedFiles).some((n) => n.length > 0)
    return hasUploaded || hasDeleted
  }, [options.uploadedFiles, options.deletedFiles])

  const hasDataChanges = useMemo(() => {
    const originalKeys = Object.keys(options.original)
    const currentKeys = Object.keys(options.current)
    
    // 检查键是否相同
    if (originalKeys.length !== currentKeys.length) {
      return true
    }
    
    // 逐字段比较
    for (const key of originalKeys) {
      if (!deepEqual(options.original[key], options.current[key])) {
        return true
      }
    }
    
    return false
  }, [options.original, options.current])

  return {
    hasChanges: hasFileChanges || hasDataChanges,
    hasFileChanges,
    hasDataChanges,
  }
}
