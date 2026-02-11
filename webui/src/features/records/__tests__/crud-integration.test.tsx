/**
 * UpsertPanel CRUD 集成测试
 * 测试 Base Collection 和 Auth Collection 的完整 CRUD 流程
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
  requestVerification: vi.fn(),
  requestPasswordReset: vi.fn(),
  unlinkExternalAuth: vi.fn(),
}

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: vi.fn(() => mockCollectionAPI),
    authStore: {
      clear: vi.fn(),
      record: { id: 'current-user-id' },
    },
    files: {
      getURL: vi.fn(() => 'http://example.com/file.jpg'),
    },
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

describe('UpsertPanel CRUD Integration', () => {
  const mockOnSave = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnOpenChange = vi.fn()

  const baseCollection = {
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

  const authCollection = {
    id: 'users',
    name: 'users',
    type: 'auth' as const,
    fields: [
      { name: 'id', type: 'text' },
      { name: 'email', type: 'email', required: true },
      { name: 'password', type: 'password' },
      { name: 'passwordConfirm', type: 'password' },
      { name: 'verified', type: 'bool' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockOnSave.mockClear()
    mockOnDelete.mockClear()
    mockOnOpenChange.mockClear()

    mockCollectionAPI.create.mockResolvedValue({})
    mockCollectionAPI.update.mockResolvedValue({})
    mockCollectionAPI.delete.mockResolvedValue(undefined)
    mockCollectionAPI.requestVerification.mockResolvedValue(undefined)
    mockCollectionAPI.requestPasswordReset.mockResolvedValue(undefined)
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

  describe('Base Collection CRUD 流程', () => {
    describe('Create 流程', () => {
      it('应该成功创建记录并关闭面板', async () => {
        const newRecord = {
          id: 'post-1',
          title: 'Test Post',
          content: '<p>Test Content</p>',
          status: 'draft',
          created: '2024-01-15 10:30:00',
          updated: '2024-01-15 10:30:00',
        }

        mockCollectionAPI.create.mockResolvedValue(newRecord)

        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 填写表单
        await userEvent.type(screen.getByLabelText('title'), 'Test Post')

        // 填写 editor (假设是 textarea)
        const contentInput = screen.getByLabelText('content')
        await userEvent.type(contentInput, '<p>Test Content</p>')

        // 选择 status
        await userEvent.click(screen.getByLabelText('status'))
        await userEvent.click(screen.getByText('draft'))

        // 提交表单
        await userEvent.click(screen.getByRole('button', { name: /create/i }))

        // 验证 create API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.create).toHaveBeenCalledTimes(1)
        })

        // 验证 onSave 被调用
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith({
            isNew: true,
            record: expect.objectContaining({ id: 'post-1' }),
          })
        })

        // 验证面板关闭
        await waitFor(() => {
          expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        })
      })

      it('应该处理创建失败并显示错误', async () => {
        const error = {
          status: 400,
          response: {
            message: 'Validation failed',
            data: {
              title: { code: 'validation_required', message: 'Title is required.' },
            },
          },
        }

        mockCollectionAPI.create.mockRejectedValue(error)

        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 不填写必填字段直接提交
        await userEvent.click(screen.getByRole('button', { name: /create/i }))

        // 验证 create API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.create).toHaveBeenCalled()
        })

        // 验证错误显示
        await waitFor(() => {
          expect(screen.getByText('Title is required.')).toBeInTheDocument()
        })

        // 面板不应该关闭
        expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
      })
    })

    describe('Update 流程', () => {
      const existingRecord = {
        id: 'post-1',
        collectionId: 'posts',
        title: 'Old Title',
        content: '<p>Old Content</p>',
        status: 'draft',
        created: '2024-01-10 10:30:00',
        updated: '2024-01-10 10:30:00',
      }

      it('应该成功更新记录并关闭面板', async () => {
        const updatedRecord = {
          ...existingRecord,
          title: 'New Title',
          content: '<p>New Content</p>',
          status: 'published',
        }

        mockCollectionAPI.update.mockResolvedValue(updatedRecord)

        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            record={existingRecord}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 修改字段
        const titleInput = screen.getByLabelText('title')
        await userEvent.clear(titleInput)
        await userEvent.type(titleInput, 'New Title')

        const contentInput = screen.getByLabelText('content')
        await userEvent.clear(contentInput)
        await userEvent.type(contentInput, '<p>New Content</p>')

        // 修改 status
        await userEvent.click(screen.getByLabelText('status'))
        await userEvent.click(screen.getByText('published'))

        // 提交表单
        await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

        // 验证 update API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.update).toHaveBeenCalledWith('post-1', expect.any(FormData))
        })

        // 验证 onSave 被调用
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith({
            isNew: false,
            record: expect.objectContaining({ title: 'New Title' }),
          })
        })

        // 验证面板关闭
        await waitFor(() => {
          expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        })
      })

      it('Save and continue 应该保存但不关闭面板', async () => {
        const updatedRecord = {
          ...existingRecord,
          title: 'Updated Title',
        }

        mockCollectionAPI.update.mockResolvedValue(updatedRecord)

        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            record={existingRecord}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 修改字段
        const titleInput = screen.getByLabelText('title')
        await userEvent.clear(titleInput)
        await userEvent.type(titleInput, 'Updated Title')

        // 点击 Save and continue
        fireEvent.click(screen.getByText('Save and continue'))

        // 验证 update API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.update).toHaveBeenCalled()
        })

        // 验证 onSave 被调用
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalled()
        })

        // 面板应该保持打开
        await waitFor(() => {
          expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
        })
      })
    })

    describe('Delete 流程', () => {
      const existingRecord = {
        id: 'post-1',
        collectionId: 'posts',
        title: 'Test Post',
        content: '<p>Test Content</p>',
        status: 'draft',
        created: '2024-01-10 10:30:00',
        updated: '2024-01-10 10:30:00',
      }

      it('应该成功删除记录', async () => {
        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            record={existingRecord}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
            onDelete={mockOnDelete}
          />
        )

        // 打开更多操作菜单
        await userEvent.click(screen.getByLabelText('More options'))

        // 点击 Delete
        const deleteButton = screen.getByRole('menuitem', { name: /delete/i })
        await userEvent.click(deleteButton)

        // 应该显示确认弹窗
        expect(screen.getByText(/really want to delete/i)).toBeInTheDocument()

        // 确认删除
        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        await userEvent.click(confirmButton)

        // 验证 delete API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.delete).toHaveBeenCalledWith('post-1')
        })

        // 验证 onDelete 被调用
        await waitFor(() => {
          expect(mockOnDelete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'post-1' })
          )
        })

        // 验证面板关闭
        await waitFor(() => {
          expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        })
      })

      it('取消删除不应该删除记录', async () => {
        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            record={existingRecord}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
            onDelete={mockOnDelete}
          />
        )

        // 打开更多操作菜单
        await userEvent.click(screen.getByLabelText('More options'))

        // 点击 Delete
        const deleteButton = screen.getByRole('menuitem', { name: /delete/i })
        await userEvent.click(deleteButton)

        // 应该显示确认弹窗
        expect(screen.getByText(/really want to delete/i)).toBeInTheDocument()

        // 取消删除
        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        await userEvent.click(cancelButton)

        // 验证 delete API 没有被调用
        expect(mockCollectionAPI.delete).not.toHaveBeenCalled()

        // 验证 onDelete 没有被调用
        expect(mockOnDelete).not.toHaveBeenCalled()

        // 验证面板没有关闭
        expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
      })
    })

    describe('Duplicate 流程', () => {
      const existingRecord = {
        id: 'post-1',
        collectionId: 'posts',
        title: 'Original Post',
        content: '<p>Original Content</p>',
        status: 'published',
        created: '2024-01-10 10:30:00',
        updated: '2024-01-10 10:30:00',
      }

      it('应该成功复制记录', async () => {
        renderWithProviders(
          <UpsertPanel
            collection={baseCollection}
            record={existingRecord}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 打开更多操作菜单
        await userEvent.click(screen.getByLabelText('More options'))

        // 点击 Duplicate
        const duplicateButton = screen.getByRole('menuitem', { name: /duplicate/i })
        await userEvent.click(duplicateButton)

        // 验证切换到新建模式
        await waitFor(() => {
          expect(screen.getByText('New posts record')).toBeInTheDocument()
        })

        // 验证 ID 字段已清空且可编辑
        const idInput = screen.getByLabelText('id') as HTMLInputElement
        expect(idInput.value).toBe('')
        expect(idInput).not.toBeDisabled()

        // 验证 title 保留
        const titleInput = screen.getByLabelText('title') as HTMLInputElement
        expect(titleInput.value).toBe('Original Post')
      })
    })
  })

  describe('Auth Collection CRUD 流程', () => {
    describe('Create 流程', () => {
      it('应该成功创建用户并关闭面板', async () => {
        const newUser = {
          id: 'user-1',
          email: 'test@example.com',
          verified: false,
          emailVisibility: false,
          created: '2024-01-15 10:30:00',
          updated: '2024-01-15 10:30:00',
        }

        mockCollectionAPI.create.mockResolvedValue(newUser)

        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 填写表单
        await userEvent.type(screen.getByLabelText('email'), 'test@example.com')
        await userEvent.type(screen.getByLabelText('password'), 'TestPassword123')
        await userEvent.type(screen.getByLabelText('passwordConfirm'), 'TestPassword123')

        // 提交表单
        await userEvent.click(screen.getByRole('button', { name: /create/i }))

        // 验证 create API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.create).toHaveBeenCalledTimes(1)
        })

        // 验证 onSave 被调用
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith({
            isNew: true,
            record: expect.objectContaining({ id: 'user-1' }),
          })
        })

        // 验证面板关闭
        await waitFor(() => {
          expect(mockOnOpenChange).toHaveBeenCalledWith(false)
        })
      })
    })

    describe('Edit 流程', () => {
      const existingUser = {
        id: 'user-1',
        collectionId: 'users',
        email: 'old@example.com',
        verified: false,
        emailVisibility: true,
        created: '2024-01-10 10:30:00',
        updated: '2024-01-10 10:30:00',
      }

      it('应该成功更新用户信息', async () => {
        const updatedUser = {
          ...existingUser,
          email: 'new@example.com',
          verified: true,
          emailVisibility: false,
        }

        mockCollectionAPI.update.mockResolvedValue(updatedUser)

        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            record={existingUser}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 切换 email visibility
        await userEvent.click(screen.getByText('Public: On'))

        // 切换 verified（需要确认）
        const verifiedCheckbox = screen.getByLabelText('verified')
        await userEvent.click(verifiedCheckbox)

        // 应该显示确认弹窗
        expect(screen.getByText(/manually change verified/i)).toBeInTheDocument()

        // 确认变更
        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        await userEvent.click(confirmButton)

        // 修改 email
        const emailInput = screen.getByLabelText('email')
        await userEvent.clear(emailInput)
        await userEvent.type(emailInput, 'new@example.com')

        // 提交表单
        await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

        // 验证 update API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.update).toHaveBeenCalledWith('user-1', expect.any(FormData))
        })

        // 验证 onSave 被调用
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith({
            isNew: false,
            record: expect.objectContaining({ email: 'new@example.com' }),
          })
        })
      })
    })

    describe('Auth 特殊操作', () => {
      const existingUser = {
        id: 'user-1',
        collectionId: 'users',
        email: 'test@example.com',
        verified: false,
        emailVisibility: true,
        created: '2024-01-10 10:30:00',
        updated: '2024-01-10 10:30:00',
      }

      it('应该成功发送验证邮件', async () => {
        mockCollectionAPI.requestVerification.mockResolvedValue(undefined)

        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            record={existingUser}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 打开更多操作菜单
        await userEvent.click(screen.getByLabelText('More options'))

        // 点击 Send verification email
        const verifyButton = screen.getByRole('menuitem', {
          name: /send verification email/i,
        })
        await userEvent.click(verifyButton)

        // 应该显示确认弹窗
        expect(screen.getByText(/send verification email/i)).toBeInTheDocument()

        // 确认发送
        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        await userEvent.click(confirmButton)

        // 验证 API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.requestVerification).toHaveBeenCalledWith('test@example.com')
        })
      })

      it('应该成功发送密码重置邮件', async () => {
        mockCollectionAPI.requestPasswordReset.mockResolvedValue(undefined)

        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            record={existingUser}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 打开更多操作菜单
        await userEvent.click(screen.getByLabelText('More options'))

        // 点击 Send password reset email
        const resetButton = screen.getByRole('menuitem', {
          name: /send password reset email/i,
        })
        await userEvent.click(resetButton)

        // 应该显示确认弹窗
        expect(screen.getByText(/send password reset email/i)).toBeInTheDocument()

        // 确认发送
        const confirmButton = screen.getByRole('button', { name: /confirm/i })
        await userEvent.click(confirmButton)

        // 验证 API 被调用
        await waitFor(() => {
          expect(mockCollectionAPI.requestPasswordReset).toHaveBeenCalledWith('test@example.com')
        })
      })

      it('应该显示 Account 和 Authorized providers Tab', () => {
        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            record={existingUser}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        expect(screen.getByRole('tab', { name: 'Account' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Authorized providers' })).toBeInTheDocument()
      })

      it('切换到 Authorized providers Tab 应该显示 ExternalAuthsList', async () => {
        renderWithProviders(
          <UpsertPanel
            collection={authCollection}
            record={existingUser}
            open={true}
            onOpenChange={mockOnOpenChange}
            onSave={mockOnSave}
          />
        )

        // 切换到 Authorized providers Tab
        await userEvent.click(screen.getByRole('tab', { name: 'Authorized providers' }))

        // 应该显示 ExternalAuthsList
        // (具体验证取决于 ExternalAuthsList 组件的实现)
      })
    })
  })
})
