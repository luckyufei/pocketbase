/**
 * T0001: Scaffolds API Hook
 * 获取 Collection 类型的默认 scaffolds（字段模板）
 */
import { useQuery } from '@tanstack/react-query'
import { getApiClient } from '@/lib/ApiClient'

const pb = getApiClient()

/**
 * Scaffold 字段定义
 */
export interface ScaffoldField {
  id?: string
  name: string
  type: string
  required?: boolean
  hidden?: boolean
  presentable?: boolean
  system?: boolean
  options?: Record<string, unknown>
}

/**
 * Scaffold 定义
 */
export interface Scaffold {
  name: string
  type: 'base' | 'auth' | 'view'
  fields: ScaffoldField[]
  indexes: string[]
  // Auth 特有选项
  passwordAuth?: {
    enabled: boolean
    identityFields: string[]
  }
  oauth2?: {
    enabled: boolean
    providers: any[]
  }
  otp?: {
    enabled: boolean
    duration: number
    length: number
    emailTemplate?: Record<string, any>
  }
  mfa?: {
    enabled: boolean
    rule: string
  }
  authAlert?: {
    enabled: boolean
    emailTemplate?: Record<string, any>
  }
  authToken?: {
    duration: number
  }
  verificationToken?: {
    duration: number
  }
  passwordResetToken?: {
    duration: number
  }
  emailChangeToken?: {
    duration: number
  }
  fileToken?: {
    duration: number
  }
  confirmEmailChangeTemplate?: Record<string, any>
  resetPasswordTemplate?: Record<string, any>
  verificationTemplate?: Record<string, any>
}

/**
 * Scaffolds 缓存类型
 */
export type ScaffoldsMap = Record<string, Scaffold>

/**
 * 获取 Collection 类型的默认 scaffolds
 * scaffolds 是不会变化的，所以设置 staleTime 为 Infinity 永久缓存
 */
export function useScaffolds() {
  return useQuery({
    queryKey: ['scaffolds'],
    queryFn: async (): Promise<ScaffoldsMap> => {
      // 调用 PocketBase 的 getScaffolds API
      const scaffolds = await pb.collections.getScaffolds()
      return scaffolds as ScaffoldsMap
    },
    staleTime: Infinity, // scaffolds 不会变化，可以永久缓存
    gcTime: Infinity, // 不清理缓存
  })
}

/**
 * 解析索引名称
 */
export function parseIndexName(indexStr: string): string {
  const match = indexStr.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i)
  return match?.[1] || ''
}

export default useScaffolds
