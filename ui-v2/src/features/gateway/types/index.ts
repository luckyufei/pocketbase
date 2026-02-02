/**
 * Gateway Types
 * 代理配置相关类型定义
 */

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  enabled: boolean
  failureThreshold: number
  recoveryTimeout: number
  halfOpenRequests: number
}

/**
 * 超时配置
 */
export interface TimeoutConfig {
  dial: number
  responseHeader: number
  idle: number
}

/**
 * 认证配置（headers 字段）
 */
export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'header'
  token?: string
  headerName?: string
  headerValue?: string
}

/**
 * 代理配置（后端字段名）
 * 对应 _proxies Collection
 */
export interface Proxy {
  id: string
  name: string
  path: string                // 拦截路径，如 /-/openai
  upstream: string            // 目标服务地址
  stripPath: boolean          // 转发时是否移除匹配前缀
  accessRule?: string         // 访问控制规则
  headers?: Record<string, string> // 注入的请求头配置
  timeout?: number            // 超时时间（秒）
  active: boolean             // 是否启用
  maxConcurrent?: number      // 最大并发数
  circuitBreaker?: CircuitBreakerConfig
  timeoutConfig?: TimeoutConfig
  created: string
  updated: string
}

/**
 * 代理输入（创建/更新时使用）
 */
export interface ProxyInput {
  name: string
  path: string
  upstream: string
  stripPath?: boolean
  accessRule?: string
  headers?: Record<string, string>
  timeout?: number
  active?: boolean
  maxConcurrent?: number
  circuitBreaker?: CircuitBreakerConfig
  timeoutConfig?: TimeoutConfig
}

/**
 * 熔断状态
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * 代理指标
 */
export interface ProxyMetrics {
  proxyName: string
  circuitState: CircuitState
  activeConnections: number
  requestsTotal: number
  errorsTotal: number
}

/**
 * 代理状态（派生自 active 和 circuitState）
 */
export type ProxyStatus = 'normal' | 'circuit-open' | 'disabled'

/**
 * 代理筛选条件
 */
export interface ProxyFilter {
  status: 'all' | ProxyStatus
  search: string
}

/**
 * 代理统计
 */
export interface ProxyStats {
  total: number
  normal: number
  circuitOpen: number
  disabled: number
}
