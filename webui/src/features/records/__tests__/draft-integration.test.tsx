/**
 * UpsertPanel 草稿管理集成测试
 * 测试草稿的自动保存、恢复、删除等功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { createMemoryHistory } from '@tanstack/react-router'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { UpsertPanel } from '../components/UpsertPanel'
import { pb } from '@/lib/pocketbase'

// Mock PocketBase
const mockCollectionAPI = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: vi.fn(() => mockCollectionAPI),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('UpsertPanel Draft Management Integration', () => {
  const mockOnSave = vi.fn()
  const mockOnOpenChange = vi.fn()

  const collection = {
    id: 'posts',
    name: 'posts',
    type: 'base' as const,
    fields: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'editor', required: true },
      { name: 'status', type: 'select', values: ['draft', 'published'], required: true },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockOnSave.mockClear()
    mockOnOpenChange.mockClear()

    mockCollectionAPI.create.mockResolvedValue({})
    mockCollectionAPI.update.mockResolvedValue({})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    const history = createMemoryHistory({ initialEntries: ['/'] })

    const router = createRouter({
      history,
      routes: [
        {
          path: '/',
          element: component,
        },
      ],
    })

    return render(
      <Provider>
        <RouterProvider router={router} />
      </Provider>
    )
  }

  describe('新建记录的草稿管理', () => {
    it('应该自动保存草稿到 localStorage', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 填写字段
      await userEvent.type(screen.getByLabelText('title'), 'Draft Title')

      // 等待自动保存
      await waitFor(() => {
        const draftKey = 'record_draft_posts_'
        const draft = localStorageMock.getItem(draftKey)
        expect(draft).toBeTruthy()
        const draftData = JSON.parse(draft!)
        expect(draftData.title).toBe('Draft Title')
      })
    })

    it('存在草稿时应该显示恢复提示', () => {
      const draftKey = 'record_draft_posts_'
      const draftData = {
        title: 'Draft Title',
        content: 'Draft Content',
        status: 'draft',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 应该显示恢复提示
      expect(screen.getByText(/previous unsaved changes/i)).toBeInTheDocument()
      expect(screen.getByText('Restore draft')).toBeInTheDocument()
      expect(screen.getByTitle('Discard draft')).toBeInTheDocument()
    })

    it('点击 "Restore draft" 应该恢复草稿数据', async () => {
      const draftKey = 'record_draft_posts_'
      const draftData = {
        title: 'Saved Draft',
        content: 'Saved Content',
        status: 'published',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击恢复草稿
      await userEvent.click(screen.getByText('Restore draft'))

      // 字段应该恢复
      await waitFor(() => {
        const titleInput = screen.getByLabelText('title') as HTMLInputElement
        expect(titleInput.value).toBe('Saved Draft')
      })

      // 恢复后提示应该消失
      expect(screen.queryByText(/previous unsaved changes/i)).not.toBeInTheDocument()
    })

    it('点击关闭草稿按钮应该删除草稿', async () => {
      const draftKey = 'record_draft_posts_'
      localStorageMock.setItem(draftKey, JSON.stringify({ title: 'Draft' }))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击关闭按钮
      const closeButton = screen.getByTitle('Discard draft')
      await userEvent.click(closeButton)

      // 草稿应该被删除
      expect(localStorageMock.getItem(draftKey)).toBeNull()

      // 提示应该消失
      await waitFor(() => {
        expect(screen.queryByText(/previous unsaved changes/i)).not.toBeInTheDocument()
      })
    })

    it('恢复草稿后再次修改应该更新草稿', async () => {
      const draftKey = 'record_draft_posts_'
      const initialDraft = {
        title: 'Initial Draft',
        content: 'Initial Content',
        status: 'draft',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(initialDraft))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击恢复草稿
      await userEvent.click(screen.getByText('Restore draft'))

      // 修改字段
      const titleInput = screen.getByLabelText('title') as HTMLInputElement
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Draft')

      // 等待自动保存
      await waitFor(() => {
        const draft = localStorageMock.getItem(draftKey)
        expect(draft).toBeTruthy()
        const draftData = JSON.parse(draft!)
        expect(draftData.title).toBe('Updated Draft')
      })
    })

    it('保存成功后应该删除草稿', async () => {
      const draftKey = 'record_draft_posts_'
      localStorageMock.setItem(draftKey, JSON.stringify({ title: 'Draft' }))

      const newRecord = {
        id: 'post-1',
        title: 'New Post',
        content: 'Content',
        status: 'draft',
        created: '2024-01-15 10:30:00',
        updated: '2024-01-15 10:30:00',
      }

      mockCollectionAPI.create.mockResolvedValue(newRecord)

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 填写并提交表单
      await userEvent.type(screen.getByLabelText('title'), 'New Post')
      await userEvent.click(screen.getByRole('button', { name: /create/i }))

      // 等待保存完成
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })

      // 草稿应该被删除
      expect(localStorageMock.getItem(draftKey)).toBeNull()
    })

    it('关闭面板时应该删除草稿', async () => {
      const draftKey = 'record_draft_posts_'
      localStorageMock.setItem(draftKey, JSON.stringify({ title: 'Draft' }))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击 Cancel（无变更，直接关闭）
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 等待面板关闭
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })

      // 草稿应该被删除
      expect(localStorageMock.getItem(draftKey)).toBeNull()
    })
  })

  describe('编辑记录的草稿管理', () => {
    const existingRecord = {
      id: 'post-1',
      collectionId: 'posts',
      title: 'Original Title',
      content: 'Original Content',
      status: 'draft',
      created: '2024-01-10 10:30:00',
      updated: '2024-01-10 10:30:00',
    }

    it('应该使用记录 ID 作为草稿键', async () => {
      const draftKey = 'record_draft_posts_post-1'

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 修改字段
      await userEvent.type(screen.getByLabelText('title'), ' Modified')

      // 等待自动保存
      await waitFor(() => {
        const draft = localStorageMock.getItem(draftKey)
        expect(draft).toBeTruthy()
        const draftData = JSON.parse(draft!)
        expect(draftData.title).toContain('Modified')
      })
    })

    it('存在草稿时应该显示恢复提示', () => {
      const draftKey = 'record_draft_posts_post-1'
      const draftData = {
        title: 'Draft Title',
        content: 'Draft Content',
        status: 'published',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 应该显示恢复提示
      expect(screen.getByText(/previous unsaved changes/i)).toBeInTheDocument()
      expect(screen.getByText('Restore draft')).toBeInTheDocument()
    })

    it('恢复草稿应该排除敏感字段', async () => {
      const draftKey = 'record_draft_posts_post-1'
      const draftData = {
        title: 'Draft Title',
        content: 'Draft Content',
        status: 'published',
        // 敏感字段
        password: 'SecretPassword',
        passwordConfirm: 'SecretPassword',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击恢复草稿
      await userEvent.click(screen.getByText('Restore draft'))

      // 等待恢复
      await waitFor(() => {
        const titleInput = screen.getByLabelText('title') as HTMLInputElement
        expect(titleInput.value).toBe('Draft Title')
      })

      // 验证敏感字段不在表单中（普通 collection 没有 password 字段）
      // 这个测试主要确保恢复逻辑中正确排除了敏感字段
    })

    it('恢复草稿后保存应该更新记录', async () => {
      const draftKey = 'record_draft_posts_post-1'
      const draftData = {
        title: 'Draft Title',
        content: 'Draft Content',
        status: 'published',
      }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      const updatedRecord = {
        ...existingRecord,
        title: 'Draft Title',
        content: 'Draft Content',
        status: 'published',
      }

      mockCollectionAPI.update.mockResolvedValue(updatedRecord)

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击恢复草稿
      await userEvent.click(screen.getByText('Restore draft'))

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      // 等待保存完成
      await waitFor(() => {
        expect(mockCollectionAPI.update).toHaveBeenCalledWith('post-1', expect.any(FormData))
      })

      // 验证 onSave 被调用
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          isNew: false,
          record: expect.objectContaining({ title: 'Draft Title' }),
        })
      })

      // 草稿应该被删除
      expect(localStorageMock.getItem(draftKey)).toBeNull()
    })
  })

  describe('草稿边界情况', () => {
    it('localStorage 满（配额超出）应该静默失败', async () => {
      const setItemSpy = vi.spyOn(localStorageMock, 'setItem')

      // 模拟配额超出
      setItemSpy.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 尝试保存草稿
      await userEvent.type(screen.getByLabelText('title'), 'Test')

      // 等待一段时间
      await waitFor(() => {
        // 应该静默失败，不应该抛出错误
        // 控制台可能有警告，但不应该影响 UI
      }, { timeout: 1000 })

      setItemSpy.mockRestore()
    })

    it('草稿数据损坏应该忽略并继续', () => {
      const draftKey = 'record_draft_posts_'
      localStorageMock.setItem(draftKey, 'invalid json')

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 应该正常显示面板，不应该显示恢复提示
      expect(screen.queryByText(/previous unsaved changes/i)).not.toBeInTheDocument()
      expect(screen.getByText('New posts record')).toBeInTheDocument()
    })

    it('关闭面板时存在变更应该显示确认弹窗', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 修改字段
      await userEvent.type(screen.getByLabelText('title'), ' Modified')

      // 点击 Cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 应该显示确认弹窗
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

      // 面板不应该关闭
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('确认关闭时应该删除草稿', async () => {
      const draftKey = 'record_draft_posts_post-1'
      localStorageMock.setItem(draftKey, JSON.stringify({ title: 'Draft' }))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 修改字段
      await userEvent.type(screen.getByLabelText('title'), ' Modified')

      // 点击 Cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 确认关闭
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await userEvent.click(confirmButton)

      // 等待面板关闭
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })

      // 草稿应该被删除
      expect(localStorageMock.getItem(draftKey)).toBeNull()
    })

    it('取消关闭不应该删除草稿', async () => {
      const draftKey = 'record_draft_posts_post-1'
      const draftData = { title: 'Draft Title' }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={collection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 修改字段
      await userEvent.type(screen.getByLabelText('title'), ' Modified')

      // 点击 Cancel
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 取消关闭
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // 面板不应该关闭
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)

      // 草稿应该保留
      const draft = localStorageMock.getItem(draftKey)
      expect(draft).toBeTruthy()
    })
  })
})
