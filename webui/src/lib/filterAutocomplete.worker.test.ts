/**
 * Filter Autocomplete Worker 测试
 * Task 11: Web Worker 优化
 * 
 * 测试 Web Worker 缓存自动补全 keys 计算
 */

import { describe, it, expect } from 'bun:test'
import {
  computeBaseKeys,
  computeRequestKeys,
  computeCollectionJoinKeys,
  type WorkerMessage,
  type WorkerResponse,
} from './filterAutocomplete.worker'
import type { CollectionModel } from 'pocketbase'

// Mock collection 数据
const mockCollections: CollectionModel[] = [
  {
    id: 'col1',
    name: 'posts',
    type: 'base',
    schema: [
      { name: 'title', type: 'text' },
      { name: 'content', type: 'editor' },
      { name: 'views', type: 'number' },
      { name: 'published', type: 'bool' },
    ],
  } as CollectionModel,
  {
    id: 'col2',
    name: 'users',
    type: 'auth',
    schema: [
      { name: 'avatar', type: 'file' },
      { name: 'bio', type: 'text' },
    ],
  } as CollectionModel,
  {
    id: 'col3',
    name: 'comments',
    type: 'base',
    schema: [
      { name: 'text', type: 'text' },
      { name: 'author', type: 'relation', options: { collectionId: 'col2' } },
      { name: 'post', type: 'relation', options: { collectionId: 'col1' } },
    ],
  } as CollectionModel,
]

describe('filterAutocomplete.worker', () => {
  // ============================================
  // 11.1 计算 baseKeys
  // ============================================
  describe('computeBaseKeys', () => {
    it('返回集合的基础字段', () => {
      const keys = computeBaseKeys(mockCollections[0], mockCollections)
      
      // 应包含系统字段
      expect(keys).toContain('id')
      expect(keys).toContain('created')
      expect(keys).toContain('updated')
      
      // 应包含自定义字段
      expect(keys).toContain('title')
      expect(keys).toContain('content')
      expect(keys).toContain('views')
      expect(keys).toContain('published')
    })

    it('auth 集合包含额外字段', () => {
      const keys = computeBaseKeys(mockCollections[1], mockCollections)
      
      // auth 专属字段
      expect(keys).toContain('email')
      expect(keys).toContain('emailVisibility')
      expect(keys).toContain('verified')
      expect(keys).toContain('username')
      
      // 自定义字段
      expect(keys).toContain('avatar')
      expect(keys).toContain('bio')
    })

    it('relation 字段展开关联集合字段', () => {
      const keys = computeBaseKeys(mockCollections[2], mockCollections)
      
      // 自身字段
      expect(keys).toContain('text')
      expect(keys).toContain('author')
      expect(keys).toContain('post')
      
      // 关联字段展开（author.* 来自 users）
      expect(keys).toContain('author.id')
      expect(keys).toContain('author.email')
      expect(keys).toContain('author.bio')
      
      // 关联字段展开（post.* 来自 posts）
      expect(keys).toContain('post.id')
      expect(keys).toContain('post.title')
    })

    it('null 集合返回空数组', () => {
      const keys = computeBaseKeys(null, mockCollections)
      expect(keys).toEqual([])
    })
  })

  // ============================================
  // 11.2 计算 requestKeys
  // ============================================
  describe('computeRequestKeys', () => {
    it('返回 @request.auth.* 字段', () => {
      const keys = computeRequestKeys(mockCollections)
      
      // 基础 auth 字段
      expect(keys).toContain('@request.auth.id')
      expect(keys).toContain('@request.auth.email')
      expect(keys).toContain('@request.auth.verified')
      expect(keys).toContain('@request.auth.username')
      
      // @request.data 字段
      expect(keys).toContain('@request.data')
    })

    it('包含所有 auth 集合的字段', () => {
      const keys = computeRequestKeys(mockCollections)
      
      // users 集合的自定义字段
      expect(keys).toContain('@request.auth.avatar')
      expect(keys).toContain('@request.auth.bio')
    })

    it('空集合返回基础 request 字段', () => {
      const keys = computeRequestKeys([])
      
      expect(keys).toContain('@request.auth.id')
      expect(keys).toContain('@request.data')
    })
  })

  // ============================================
  // 11.3 计算 collectionJoinKeys
  // ============================================
  describe('computeCollectionJoinKeys', () => {
    it('返回 @collection.collectionName.* 格式', () => {
      const keys = computeCollectionJoinKeys(mockCollections)
      
      // 每个集合的 id 字段
      expect(keys).toContain('@collection.posts.id')
      expect(keys).toContain('@collection.users.id')
      expect(keys).toContain('@collection.comments.id')
    })

    it('包含集合的所有字段', () => {
      const keys = computeCollectionJoinKeys(mockCollections)
      
      // posts 字段
      expect(keys).toContain('@collection.posts.title')
      expect(keys).toContain('@collection.posts.content')
      expect(keys).toContain('@collection.posts.views')
      
      // users 字段
      expect(keys).toContain('@collection.users.email')
      expect(keys).toContain('@collection.users.bio')
      
      // comments 字段
      expect(keys).toContain('@collection.comments.text')
      expect(keys).toContain('@collection.comments.author')
    })

    it('空集合返回空数组', () => {
      const keys = computeCollectionJoinKeys([])
      expect(keys).toEqual([])
    })
  })

  // ============================================
  // Worker 消息处理（如果需要测试完整 Worker）
  // ============================================
  describe('Worker 消息格式', () => {
    it('WorkerMessage 类型正确', () => {
      const message: WorkerMessage = {
        type: 'compute',
        payload: {
          collection: mockCollections[0],
          collections: mockCollections,
        },
      }
      
      expect(message.type).toBe('compute')
      expect(message.payload.collection).toBeDefined()
      expect(message.payload.collections).toHaveLength(3)
    })

    it('WorkerResponse 类型正确', () => {
      const response: WorkerResponse = {
        type: 'result',
        payload: {
          baseKeys: ['id', 'title'],
          requestKeys: ['@request.auth.id'],
          collectionJoinKeys: ['@collection.posts.id'],
        },
      }
      
      expect(response.type).toBe('result')
      expect(response.payload.baseKeys).toContain('id')
    })
  })
})
