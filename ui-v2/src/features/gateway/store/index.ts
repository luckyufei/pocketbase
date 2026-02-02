/**
 * Gateway Store
 * 代理配置状态管理
 */
import { atom } from 'jotai'
import type { Proxy, ProxyMetrics, ProxyFilter, ProxyStats, ProxyStatus } from '../types'

// 重新导出类型
export type { Proxy, ProxyMetrics, ProxyFilter, ProxyStats, ProxyStatus }

// ============ 基础 Atoms ============

/**
 * 代理列表
 */
export const proxiesAtom = atom<Proxy[]>([])

/**
 * 代理指标
 */
export const metricsAtom = atom<ProxyMetrics[]>([])

/**
 * 加载状态
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * 筛选条件
 */
export const filterAtom = atom<ProxyFilter>({
  status: 'all',
  search: '',
})

// ============ 写入 Atoms ============

/**
 * 设置代理列表
 */
export const setProxiesAtom = atom(null, (_get, set, proxies: Proxy[]) => {
  set(proxiesAtom, proxies)
})

/**
 * 设置指标数据
 */
export const setMetricsAtom = atom(null, (_get, set, metrics: ProxyMetrics[]) => {
  set(metricsAtom, metrics)
})

/**
 * 设置筛选条件
 */
export const setFilterAtom = atom(null, (_get, set, filter: ProxyFilter) => {
  set(filterAtom, filter)
})

/**
 * 设置加载状态
 */
export const setIsLoadingAtom = atom(null, (_get, set, loading: boolean) => {
  set(isLoadingAtom, loading)
})

// ============ 辅助函数 ============

/**
 * 获取代理状态
 */
function getProxyStatus(proxy: Proxy, metrics: ProxyMetrics[]): ProxyStatus {
  if (!proxy.active) {
    return 'disabled'
  }

  const proxyMetrics = metrics.find((m) => m.proxyName === proxy.name)
  if (proxyMetrics && proxyMetrics.circuitState === 'open') {
    return 'circuit-open'
  }

  return 'normal'
}

// ============ 派生 Atoms ============

/**
 * 统计数据（派生）
 */
export const statsAtom = atom<ProxyStats>((get) => {
  const proxies = get(proxiesAtom)
  const metrics = get(metricsAtom)

  let normal = 0
  let circuitOpen = 0
  let disabled = 0

  for (const proxy of proxies) {
    const status = getProxyStatus(proxy, metrics)
    switch (status) {
      case 'normal':
        normal++
        break
      case 'circuit-open':
        circuitOpen++
        break
      case 'disabled':
        disabled++
        break
    }
  }

  return {
    total: proxies.length,
    normal,
    circuitOpen,
    disabled,
  }
})

/**
 * 筛选后的代理列表（派生）
 */
export const filteredProxiesAtom = atom<Proxy[]>((get) => {
  const proxies = get(proxiesAtom)
  const metrics = get(metricsAtom)
  const filter = get(filterAtom)

  return proxies.filter((proxy) => {
    // 状态筛选
    if (filter.status !== 'all') {
      const status = getProxyStatus(proxy, metrics)
      if (status !== filter.status) {
        return false
      }
    }

    // 搜索筛选（按名称或路径）
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      const nameMatch = proxy.name.toLowerCase().includes(searchLower)
      const pathMatch = proxy.path.toLowerCase().includes(searchLower)
      if (!nameMatch && !pathMatch) {
        return false
      }
    }

    return true
  })
})

/**
 * 获取代理状态（导出供其他模块使用）
 */
export { getProxyStatus }
