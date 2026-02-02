/**
 * useProxies Hook
 * 代理配置管理 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import { toast } from 'sonner'
import {
  proxiesAtom,
  metricsAtom,
  isLoadingAtom,
  filterAtom,
  statsAtom,
  filteredProxiesAtom,
  setProxiesAtom,
  setMetricsAtom,
  setFilterAtom,
  setIsLoadingAtom,
  getProxyStatus as getProxyStatusFn,
  type Proxy,
  type ProxyMetrics,
  type ProxyFilter,
} from '../store'

/**
 * 解析 Prometheus 指标格式
 */
function parsePrometheusMetrics(text: string): ProxyMetrics[] {
  const metricsMap = new Map<string, Partial<ProxyMetrics>>()

  const lines = text.split('\n')
  for (const line of lines) {
    // 跳过注释和空行
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    // 解析 gateway_circuit_breaker_state{proxy="name"} value
    const circuitMatch = line.match(/gateway_circuit_breaker_state\{proxy="([^"]+)"\}\s+(\d+)/)
    if (circuitMatch) {
      const [, proxyName, value] = circuitMatch
      if (!metricsMap.has(proxyName)) {
        metricsMap.set(proxyName, { proxyName })
      }
      const stateValue = parseInt(value, 10)
      metricsMap.get(proxyName)!.circuitState =
        stateValue === 0 ? 'closed' : stateValue === 1 ? 'open' : 'half-open'
    }

    // 解析 gateway_active_connections{proxy="name"} value
    const connMatch = line.match(/gateway_active_connections\{proxy="([^"]+)"\}\s+(\d+)/)
    if (connMatch) {
      const [, proxyName, value] = connMatch
      if (!metricsMap.has(proxyName)) {
        metricsMap.set(proxyName, { proxyName })
      }
      metricsMap.get(proxyName)!.activeConnections = parseInt(value, 10)
    }

    // 解析 gateway_requests_total{proxy="name",status="xxx"} value
    const reqMatch = line.match(/gateway_requests_total\{proxy="([^"]+)"[^}]*\}\s+(\d+)/)
    if (reqMatch) {
      const [, proxyName, value] = reqMatch
      if (!metricsMap.has(proxyName)) {
        metricsMap.set(proxyName, { proxyName })
      }
      const current = metricsMap.get(proxyName)!.requestsTotal || 0
      metricsMap.get(proxyName)!.requestsTotal = current + parseInt(value, 10)
    }

    // 解析 gateway_errors_total{proxy="name"} value
    const errMatch = line.match(/gateway_errors_total\{proxy="([^"]+)"\}\s+(\d+)/)
    if (errMatch) {
      const [, proxyName, value] = errMatch
      if (!metricsMap.has(proxyName)) {
        metricsMap.set(proxyName, { proxyName })
      }
      metricsMap.get(proxyName)!.errorsTotal = parseInt(value, 10)
    }
  }

  // 转换为数组，填充默认值
  return Array.from(metricsMap.values()).map((m) => ({
    proxyName: m.proxyName!,
    circuitState: m.circuitState || 'closed',
    activeConnections: m.activeConnections || 0,
    requestsTotal: m.requestsTotal || 0,
    errorsTotal: m.errorsTotal || 0,
  }))
}

/**
 * 代理配置管理 Hook
 */
export function useProxies() {
  const proxies = useAtomValue(proxiesAtom)
  const filteredProxies = useAtomValue(filteredProxiesAtom)
  const stats = useAtomValue(statsAtom)
  const metrics = useAtomValue(metricsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const filter = useAtomValue(filterAtom)

  const setProxies = useSetAtom(setProxiesAtom)
  const setMetrics = useSetAtom(setMetricsAtom)
  const setFilter = useSetAtom(setFilterAtom)

  const pb = getApiClient()

  /**
   * 加载代理列表
   */
  const loadProxies = useCallback(async () => {
    setIsLoading(true)

    try {
      const result = await pb.send('/api/collections/_proxies/records', {
        method: 'GET',
      })

      // 处理返回的数据格式（可能是数组或包含 items 的对象）
      const proxiesList = Array.isArray(result) ? result : result?.items || []
      setProxies(proxiesList as Proxy[])
    } catch (err) {
      console.error('Failed to load proxies:', err)
      toast.error('加载代理配置失败')
    } finally {
      setIsLoading(false)
    }
  }, [pb, setProxies, setIsLoading])

  /**
   * 加载指标数据
   */
  const loadMetrics = useCallback(async () => {
    try {
      const result = await pb.send('/api/gateway/metrics', {
        method: 'GET',
      })

      // 解析 Prometheus 格式的指标
      if (typeof result === 'string') {
        const parsedMetrics = parsePrometheusMetrics(result)
        setMetrics(parsedMetrics)
      }
    } catch (err) {
      console.error('Failed to load metrics:', err)
      // 指标加载失败不显示错误提示，因为这是后台轮询
    }
  }, [pb, setMetrics])

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadProxies(), loadMetrics()])
  }, [loadProxies, loadMetrics])

  /**
   * 获取代理状态
   */
  const getProxyStatus = useCallback(
    (proxy: Proxy) => {
      return getProxyStatusFn(proxy, metrics)
    },
    [metrics]
  )

  return {
    // 状态
    proxies,
    filteredProxies,
    stats,
    metrics,
    isLoading,
    filter,

    // 操作
    loadProxies,
    loadMetrics,
    refresh,
    setFilter,
    getProxyStatus,
  }
}
