/**
 * 记录计数组件
 * 展示集合中的记录总数
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase'

interface RecordsCountProps {
  collectionIdOrName: string
  filter?: string
  className?: string
}

export function RecordsCount({ collectionIdOrName, filter, className = '' }: RecordsCountProps) {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchCount = async () => {
      if (!collectionIdOrName) {
        setCount(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await pb.collection(collectionIdOrName).getList(1, 1, { filter })
        if (!cancelled) {
          setCount(result.totalItems)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取记录数失败')
          setCount(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCount()

    return () => {
      cancelled = true
    }
  }, [collectionIdOrName, filter])

  if (loading) {
    return <Loader2 className={`h-4 w-4 animate-spin ${className}`} />
  }

  if (error) {
    return <span className={`text-destructive text-sm ${className}`}>-</span>
  }

  return <span className={`text-sm ${className}`}>{count?.toLocaleString() ?? '-'}</span>
}
