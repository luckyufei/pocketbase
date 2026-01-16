/**
 * PocketBase 实例导出
 * 为了兼容旧代码中的 @/lib/pocketbase 导入
 */
import { getApiClient } from './ApiClient'

// 导出默认实例
export const pb = getApiClient()
export default pb
