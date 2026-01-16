/**
 * PocketBase API 客户端封装
 * 提供单例模式的 PocketBase 实例
 */
import PocketBase from 'pocketbase'

// 单例实例
let pbInstance: PocketBase | null = null

/**
 * 获取默认的 API 基础 URL
 * 使用相对路径，由 Vite 代理处理开发环境请求
 */
function getDefaultBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '/'
  }
  return import.meta.env.VITE_API_URL || '/'
}

/**
 * 获取 PocketBase 单例实例
 * @param baseUrl 可选的自定义 API 基础 URL
 * @returns PocketBase 实例
 */
export function getApiClient(baseUrl?: string): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(baseUrl || getDefaultBaseUrl())
  } else if (baseUrl && pbInstance.baseURL !== baseUrl) {
    // 如果提供了新的 baseUrl，更新实例
    pbInstance = new PocketBase(baseUrl)
  }
  return pbInstance
}

/**
 * 重置 API 客户端（用于测试）
 */
export function resetApiClient(): void {
  pbInstance = null
}

/**
 * ApiClient 类封装
 * 提供更便捷的 API 访问方式
 */
export class ApiClient {
  public readonly pb: PocketBase

  constructor(baseUrl?: string) {
    this.pb = getApiClient(baseUrl)
  }

  /**
   * 获取认证存储
   */
  get authStore() {
    return this.pb.authStore
  }

  /**
   * 检查是否已认证
   */
  get isAuthenticated(): boolean {
    return this.pb.authStore.isValid
  }

  /**
   * 获取当前用户
   */
  get currentUser() {
    return this.pb.authStore.record
  }

  /**
   * 获取当前 Token
   */
  get token(): string {
    return this.pb.authStore.token
  }

  /**
   * 清除认证状态
   */
  logout(): void {
    this.pb.authStore.clear()
  }
}

// 导出默认实例
export const apiClient = new ApiClient()

// 导出 PocketBase 实例（便捷访问）
export const pb = getApiClient()

export default apiClient
