/**
 * 记录信息内容组件
 * 展示记录的主要标识信息（如邮箱、用户名或 ID）
 */
import type { RecordModel } from 'pocketbase'

interface RecordInfoContentProps {
  record: RecordModel
}

export function RecordInfoContent({ record }: RecordInfoContentProps) {
  // 尝试获取最有意义的展示值
  const displayValue =
    record.email || record.username || record.name || record.title || record.id || 'N/A'

  return (
    <span className="truncate text-sm" title={displayValue}>
      {displayValue}
    </span>
  )
}
