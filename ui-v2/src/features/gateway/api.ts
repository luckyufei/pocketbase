/**
 * Gateway API 服务
 * 代理配置相关 API 操作
 */
import { getApiClient } from '@/lib/ApiClient'
import type { Proxy, ProxyInput } from './types'

/**
 * 获取所有代理配置
 */
export async function getProxies(): Promise<Proxy[]> {
  const pb = getApiClient()
  const result = await pb.send('/api/collections/_proxies/records', {
    method: 'GET',
    // 禁用自动取消，避免组件重新渲染时请求被取消
    requestKey: null,
  })

  // 处理返回的数据格式（可能是数组或包含 items 的对象）
  return Array.isArray(result) ? result : result?.items || []
}

/**
 * 获取单个代理配置
 */
export async function getProxy(id: string): Promise<Proxy> {
  const pb = getApiClient()
  return await pb.send(`/api/collections/_proxies/records/${id}`, {
    method: 'GET',
    // 禁用自动取消，避免组件重新渲染时请求被取消
    requestKey: null,
  })
}

/**
 * 创建代理配置
 */
export async function createProxy(data: ProxyInput): Promise<Proxy> {
  const pb = getApiClient()
  return await pb.send('/api/collections/_proxies/records', {
    method: 'POST',
    body: data,
  })
}

/**
 * 更新代理配置
 */
export async function updateProxy(id: string, data: ProxyInput): Promise<Proxy> {
  const pb = getApiClient()
  return await pb.send(`/api/collections/_proxies/records/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

/**
 * 删除代理配置
 */
export async function deleteProxy(id: string): Promise<void> {
  const pb = getApiClient()
  await pb.send(`/api/collections/_proxies/records/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 获取网关指标（Prometheus 格式）
 */
export async function getMetrics(): Promise<string> {
  const pb = getApiClient()
  return await pb.send('/api/gateway/metrics', {
    method: 'GET',
  })
}
