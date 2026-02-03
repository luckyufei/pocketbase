/**
 * Filter Autocomplete Worker
 * Task 11: Web Worker 优化
 * 
 * 缓存自动补全 keys 计算，提升大型集合的性能
 */

import type { CollectionModel, SchemaField } from 'pocketbase'

// Worker 消息类型
export interface WorkerMessage {
  type: 'compute'
  payload: {
    collection: CollectionModel | null
    collections: CollectionModel[]
  }
}

export interface WorkerResponse {
  type: 'result'
  payload: {
    baseKeys: string[]
    requestKeys: string[]
    collectionJoinKeys: string[]
  }
}

// 系统字段
const BASE_SYSTEM_FIELDS = ['id', 'created', 'updated']
const AUTH_SYSTEM_FIELDS = ['email', 'emailVisibility', 'verified', 'username', 'tokenKey', 'lastResetSentAt', 'lastVerificationSentAt']

/**
 * 计算集合的基础字段 keys
 * 包括系统字段、自定义字段、关联字段展开
 */
export function computeBaseKeys(
  collection: CollectionModel | null,
  collections: CollectionModel[],
  depth: number = 0,
  maxDepth: number = 2
): string[] {
  if (!collection) return []
  
  const keys: string[] = []
  
  // 添加系统字段
  keys.push(...BASE_SYSTEM_FIELDS)
  
  // auth 集合添加额外系统字段
  if (collection.type === 'auth') {
    keys.push(...AUTH_SYSTEM_FIELDS)
  }
  
  // 添加 schema 字段
  const schema = collection.schema || []
  for (const field of schema) {
    keys.push(field.name)
    
    // 关联字段展开（限制递归深度）
    if (field.type === 'relation' && depth < maxDepth) {
      const relatedCollectionId = (field.options as { collectionId?: string })?.collectionId
      if (relatedCollectionId) {
        const relatedCollection = collections.find(c => c.id === relatedCollectionId)
        if (relatedCollection) {
          const relatedKeys = computeBaseKeys(relatedCollection, collections, depth + 1, maxDepth)
          for (const relatedKey of relatedKeys) {
            // 只展开一层，不递归展开关联的关联
            if (!relatedKey.includes('.')) {
              keys.push(`${field.name}.${relatedKey}`)
            }
          }
        }
      }
    }
  }
  
  return keys
}

/**
 * 计算 @request.* keys
 */
export function computeRequestKeys(collections: CollectionModel[]): string[] {
  const keys: string[] = []
  
  // 基础 @request.auth 字段
  keys.push('@request.auth.id')
  keys.push('@request.auth.collectionId')
  keys.push('@request.auth.collectionName')
  
  // 添加 auth 系统字段
  for (const field of AUTH_SYSTEM_FIELDS) {
    keys.push(`@request.auth.${field}`)
  }
  
  // 从所有 auth 集合收集自定义字段
  const authCollections = collections.filter(c => c.type === 'auth')
  const authFields = new Set<string>()
  
  for (const collection of authCollections) {
    const schema = collection.schema || []
    for (const field of schema) {
      authFields.add(field.name)
    }
  }
  
  for (const fieldName of authFields) {
    keys.push(`@request.auth.${fieldName}`)
  }
  
  // @request.data 字段
  keys.push('@request.data')
  
  return keys
}

/**
 * 计算 @collection.* keys
 */
export function computeCollectionJoinKeys(collections: CollectionModel[]): string[] {
  if (collections.length === 0) return []
  
  const keys: string[] = []
  
  for (const collection of collections) {
    const prefix = `@collection.${collection.name}`
    
    // 系统字段
    for (const field of BASE_SYSTEM_FIELDS) {
      keys.push(`${prefix}.${field}`)
    }
    
    // auth 集合的额外系统字段
    if (collection.type === 'auth') {
      for (const field of AUTH_SYSTEM_FIELDS) {
        keys.push(`${prefix}.${field}`)
      }
    }
    
    // 自定义字段
    const schema = collection.schema || []
    for (const field of schema) {
      keys.push(`${prefix}.${field.name}`)
    }
  }
  
  return keys
}

/**
 * 处理 Worker 消息
 * 注意：在单元测试中，我们直接测试导出的函数
 * 在实际 Worker 环境中，这个函数会处理 postMessage
 */
export function handleMessage(message: WorkerMessage): WorkerResponse {
  const { collection, collections } = message.payload
  
  return {
    type: 'result',
    payload: {
      baseKeys: computeBaseKeys(collection, collections),
      requestKeys: computeRequestKeys(collections),
      collectionJoinKeys: computeCollectionJoinKeys(collections),
    },
  }
}

// Worker 环境检测和初始化
if (typeof self !== 'undefined' && typeof (self as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const response = handleMessage(event.data)
    ;(self as Worker).postMessage(response)
  }
}
