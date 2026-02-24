/**
 * DatabaseStats - 数据库统计组件
 * 与 ui 版本 DatabaseStats.svelte 一致
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiClient } from '@/lib/ApiClient'
import { MetricsCard } from './MetricsCard'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DatabaseStatsProps {
  compact?: boolean
  refreshInterval?: number
}

interface DbStats {
  // SQLite
  wal_size?: number
  database_size?: number
  open_connections?: number
  page_count?: number
  // PostgreSQL
  active_connections?: number
  max_connections?: number
  cache_hit_ratio?: number
  avg_query_time?: number
}

export function DatabaseStats({ compact = false, refreshInterval = 30000 }: DatabaseStatsProps) {
  const { t } = useTranslation()
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [dbType, setDbType] = useState<'sqlite' | 'postgresql'>('sqlite')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pb = getApiClient()

  const loadDatabaseStats = useCallback(async () => {
    try {
      setError(null)
      const response = await pb.send('/api/system/metrics/database', {
        method: 'GET',
        requestKey: `db-stats-${Date.now()}`,
      })
      setDbStats(response.stats)
      setDbType(response.type)
    } catch (err: any) {
      if (err.isAbort) return
      setError(err.message || t('databaseStats.loadError'))
      console.error('Database stats error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [pb])

  useEffect(() => {
    loadDatabaseStats()

    if (refreshInterval > 0) {
      const interval = setInterval(loadDatabaseStats, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [loadDatabaseStats, refreshInterval])

  function formatBytes(bytes: number | undefined) {
    if (!bytes) return '-'
    const mb = bytes / (1024 * 1024)
    return mb.toFixed(2)
  }

  function formatPercent(value: number | undefined) {
    if (value === null || value === undefined) return '-'
    return Number(value).toFixed(1)
  }

  // SQLite 专用指标
  const sqliteStats =
    dbType === 'sqlite'
      ? [
          { title: t('databaseStats.walSize'), value: formatBytes(dbStats?.wal_size), unit: 'MB', icon: 'database' as const },
          { title: t('databaseStats.databaseSize'), value: formatBytes(dbStats?.database_size), unit: 'MB', icon: 'database' as const },
          { title: t('databaseStats.activeConnections'), value: dbStats?.open_connections?.toString() || '-', icon: 'link' as const },
          { title: t('databaseStats.pageCount'), value: dbStats?.page_count?.toString() || '-', icon: 'page' as const },
        ]
      : []

  // PostgreSQL 专用指标
  const postgresStats =
    dbType === 'postgresql'
      ? [
          {
            title: t('databaseStats.activeConnections'),
            value: `${dbStats?.active_connections || 0}/${dbStats?.max_connections || 100}`,
            icon: 'link' as const,
          },
          { title: t('databaseStats.databaseSize'), value: formatBytes(dbStats?.database_size), unit: 'MB', icon: 'database' as const },
          { title: t('databaseStats.cacheHitRatio'), value: formatPercent(dbStats?.cache_hit_ratio), unit: '%', icon: 'cpu' as const },
          { title: t('databaseStats.avgQueryTime'), value: formatPercent(dbStats?.avg_query_time), unit: 'ms', icon: 'timer' as const },
        ]
      : []

  const currentStats = dbType === 'postgresql' ? postgresStats : sqliteStats

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
        <span>⚠</span>
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={loadDatabaseStats}>
          {t('databaseStats.retry')}
        </Button>
      </div>
    )
  }

  if (currentStats.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-5 text-slate-500 text-sm">
        <span>🗄️</span>
        <span>{t('databaseStats.noData')}</span>
      </div>
    )
  }

  return (
    <div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
        {currentStats.map((stat) => (
          <MetricsCard key={stat.title} title={stat.title} value={stat.value} unit={stat.unit} icon={stat.icon} />
        ))}
      </div>

      {!compact && (
        <div className="mt-3 flex justify-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full uppercase tracking-wide ${
              dbType === 'sqlite' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            🗄️ {dbType === 'sqlite' ? 'SQLite' : 'PostgreSQL'}
          </span>
        </div>
      )}
    </div>
  )
}

export default DatabaseStats
