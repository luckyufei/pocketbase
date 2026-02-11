/**
 * UpsertPanel 组件测试
 * 测试核心功能：新建/编辑模式、表单提交、草稿管理、错误处理等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { createMemoryHistory } from '@tanstack/react-router'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { UpsertPanel } from '../UpsertPanel'
import { pb } from '@/lib/pocketbase'
import { formErrorsAtom, setFormErrorsAtom, clearFormErrorsAtom } from '@/store/formErrors'

// Mock PocketBase
vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: vi.fn(() => ({
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      requestVerification: vi.fn(),
      requestPasswordReset: vi.fn(),
    })),
    authStore: {
      clear: vi.fn(),
      record: { id: 'current-user-id' },
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

describe('UpsertPanel', () => {
  const mockOnSave = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnOpenChange = vi.fn()

  const baseCollection = {
    id: 'test-collection',
    name: 'test',
    type: 'base' as const,
    fields: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text', required: true },
      { name: 'status', type: 'select', values: ['active', 'inactive'], required: true },
    ],
  }

  const authCollection = {
    id: 'auth-collection',
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

  describe('New Record 模式', () => {
    it('应该显示 "New {collection.name} record" 标题', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('New test record')).toBeInTheDocument()
    })

    it('ID 字段应该可编辑', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      const idInput = screen.getByLabelText('id')
      expect(idInput).not.toBeDisabled()
    })

    it('有 autogeneratePattern 时应该显示提示文本', () => {
      const collectionWithAutogen = {
        ...baseCollection,
        fields: [
          { name: 'id', type: 'text', autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'title', type: 'text', required: true },
        ],
      }

      renderWithProviders(
        <UpsertPanel
          collection={collectionWithAutogen}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      const idInput = screen.getByLabelText('id')
      expect(idInput).toHaveAttribute('placeholder', 'Leave empty to auto generate...')
    })

    it('不应该显示更多操作菜单', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByLabelText('More options')).not.toBeInTheDocument()
    })

    it('应该显示 "Create" 按钮', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    it('不应该显示 "Save and continue" 下拉按钮', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByText('Save and continue')).not.toBeInTheDocument()
    })

    it('不应该显示 Tab 切换', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByRole('tab', { name: /account/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /authorized providers/i })).not.toBeInTheDocument()
    })
  })

  describe('Edit Record 模式', () => {
    const existingRecord = {
      id: 'test-id',
      collectionId: 'test-collection',
      title: 'Test Title',
      status: 'active',
      created: '2024-01-01 00:00:00',
      updated: '2024-01-02 00:00:00',
    }

    it('应该显示 "Edit {collection.name} record" 标题', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Edit test record')).toBeInTheDocument()
    })

    it('ID 字段应该只读', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      const idInput = screen.getByLabelText('id')
      expect(idInput).toBeDisabled()
    })

    it('应该显示 AutodateIcon', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByTitle(/created.*updated/i)).toBeInTheDocument()
    })

    it('应该显示更多操作菜单', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByLabelText('More options')).toBeInTheDocument()
    })

    it('应该显示 "Save changes" 按钮', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('应该显示 "Save and continue" 下拉按钮', () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Save and continue')).toBeInTheDocument()
    })
  })

  describe('Auth Collection 特殊处理', () => {
    const authRecord = {
      id: 'auth-id',
      collectionId: 'auth-collection',
      email: 'test@example.com',
      verified: false,
      emailVisibility: true,
    }

    it('应该显示 email, password, passwordConfirm, verified 字段', () => {
      renderWithProviders(
        <UpsertPanel
          collection={authCollection}
          record={authRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByLabelText('email')).toBeInTheDocument()
      expect(screen.getByLabelText('password')).toBeInTheDocument()
      expect(screen.getByLabelText('passwordConfirm')).toBeInTheDocument()
      expect(screen.getByLabelText('verified')).toBeInTheDocument()
    })

    it('应该显示 "Public: On/Off" 切换按钮', () => {
      renderWithProviders(
        <UpsertPanel
          collection={authCollection}
          record={authRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Public: On')).toBeInTheDocument()
    })

    it('新建时 email 应该 autofocus', () => {
      renderWithProviders(
        <UpsertPanel
          collection={authCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      const emailInput = screen.getByLabelText('email')
      expect(emailInput).toHaveFocus()
    })

    it('superusers Collection 不应该显示 emailVisibility 切换和 verified 字段', () => {
      const superusersCollection = {
        ...authCollection,
        id: '_superusers',
        name: 'superusers',
      }

      renderWithProviders(
        <UpsertPanel
          collection={superusersCollection}
          record={authRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByText('Public:')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('verified')).not.toBeInTheDocument()
    })

    it('编辑 Auth Collection 应该显示 Account 和 Authorized providers Tab', () => {
      renderWithProviders(
        <UpsertPanel
          collection={authCollection}
          record={authRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByRole('tab', { name: 'Account' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Authorized providers' })).toBeInTheDocument()
    })

    it('新建 Auth Collection 不应该显示 Tab', () => {
      renderWithProviders(
        <UpsertPanel
          collection={authCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByRole('tab', { name: 'Account' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Authorized providers' })).not.toBeInTheDocument()
    })
  })

  describe('表单提交', () => {
    it('新建记录成功时应该调用 onSave 并关闭面板', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'new-id',
        title: 'Test',
        status: 'active',
      })

      vi.mocked(pb.collection).mockReturnValue({
        create: mockCreate,
        update: vi.fn(),
        delete: vi.fn(),
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 填写表单
      await userEvent.type(screen.getByLabelText('title'), 'Test')
      await userEvent.click(screen.getByLabelText('status'))
      await userEvent.click(screen.getByText('active'))

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          isNew: true,
          record: expect.objectContaining({ id: 'new-id' }),
        })
      })

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('编辑记录成功时应该调用 onSave 并关闭面板', async () => {
      const existingRecord = {
        id: 'test-id',
        collectionId: 'test-collection',
        title: 'Old Title',
        status: 'active',
      }

      const mockUpdate = vi.fn().mockResolvedValue({
        ...existingRecord,
        title: 'New Title',
      })

      vi.mocked(pb.collection).mockReturnValue({
        create: vi.fn(),
        update: mockUpdate,
        delete: vi.fn(),
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

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

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('test-id', expect.any(FormData))
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          isNew: false,
          record: expect.objectContaining({ title: 'New Title' }),
        })
      })
    })

    it('点击 "Save and continue" 应该保存但不关闭面板', async () => {
      const existingRecord = {
        id: 'test-id',
        collectionId: 'test-collection',
        title: 'Test',
        status: 'active',
      }

      const mockUpdate = vi.fn().mockResolvedValue(existingRecord)

      vi.mocked(pb.collection).mockReturnValue({
        create: vi.fn(),
        update: mockUpdate,
        delete: vi.fn(),
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

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
      await userEvent.type(titleInput, 'Updated')

      // 点击 Save and continue
      fireEvent.click(screen.getByText('Save and continue'))

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })

      // 面板应该保持打开
      await waitFor(() => {
        expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
      })
    })
  })

  describe('草稿管理', () => {
    it('面板打开时应该从 localStorage 恢复草稿', () => {
      const draftKey = 'record_draft_test-collection_'
      const draftData = { title: 'Draft Title', status: 'active' }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 应该显示恢复草稿提示
      expect(screen.getByText(/previous unsaved changes/i)).toBeInTheDocument()
      expect(screen.getByText('Restore draft')).toBeInTheDocument()
    })

    it('点击 "Restore draft" 应该恢复草稿数据', async () => {
      const draftKey = 'record_draft_test-collection_'
      const draftData = { title: 'Draft Title', status: 'active' }
      localStorageMock.setItem(draftKey, JSON.stringify(draftData))

      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击恢复草稿
      await userEvent.click(screen.getByText('Restore draft'))

      // 字段应该恢复
      await waitFor(() => {
        const titleInput = screen.getByLabelText('title')
        expect(titleInput).toHaveValue('Draft Title')
      })

      // 提示应该消失
      expect(screen.queryByText(/previous unsaved changes/i)).not.toBeInTheDocument()
    })

    it('关闭草稿提示按钮应该删除草稿', async () => {
      const draftKey = 'record_draft_test-collection_'
      localStorageMock.setItem(draftKey, JSON.stringify({ title: 'Draft' }))

      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
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
  })

  describe('未保存变更确认', () => {
    it('有变更时关闭面板应该显示确认弹窗', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={{ id: 'test-id', collectionId: 'test-collection', title: 'Old' }}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 修改字段
      await userEvent.type(screen.getByLabelText('title'), ' Modified')

      // 尝试关闭面板（点击 Cancel 按钮）
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 应该显示确认弹窗
      await waitFor(() => {
        expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
      })

      // 面板不应该关闭
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('无变更时关闭面板应该直接关闭', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={{ id: 'test-id', collectionId: 'test-collection', title: 'Test' }}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击 Cancel 按钮
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      // 面板应该关闭
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Ctrl+S 快捷键', () => {
    it('Ctrl+S 应该触发表单保存（不关闭面板）', async () => {
      const existingRecord = {
        id: 'test-id',
        collectionId: 'test-collection',
        title: 'Test',
        status: 'active',
      }

      const mockUpdate = vi.fn().mockResolvedValue(existingRecord)

      vi.mocked(pb.collection).mockReturnValue({
        create: vi.fn(),
        update: mockUpdate,
        delete: vi.fn(),
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

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
      await userEvent.type(screen.getByLabelText('title'), ' Updated')

      // 按 Ctrl+S
      fireEvent.keyDown(document, {
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
      })

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })

      // 面板应该保持打开
      await waitFor(() => {
        expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
      })
    })

    it('Cmd+S (Mac) 应该触发表单保存', async () => {
      const existingRecord = {
        id: 'test-id',
        collectionId: 'test-collection',
        title: 'Test',
        status: 'active',
      }

      const mockUpdate = vi.fn().mockResolvedValue(existingRecord)

      vi.mocked(pb.collection).mockReturnValue({
        create: vi.fn(),
        update: mockUpdate,
        delete: vi.fn(),
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

      renderWithProviders(
        <UpsertPanel
          collection={baseCollection}
          record={existingRecord}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 按 Cmd+S
      fireEvent.keyDown(document, {
        key: 's',
        code: 'KeyS',
        metaKey: true,
      })

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('更多操作菜单', () => {
    const existingRecord = {
      id: 'test-id',
      collectionId: 'test-collection',
      title: 'Test',
      status: 'active',
    }

    it('点击 "Delete" 应该删除记录', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined)

      vi.mocked(pb.collection).mockReturnValue({
        create: vi.fn(),
        update: vi.fn(),
        delete: mockDelete,
        requestVerification: vi.fn(),
        requestPasswordReset: vi.fn(),
      } as any)

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

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('test-id')
      })

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-id' }))
      })

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('点击 "Duplicate" 应该复制记录', async () => {
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

      // 应该切换到新建模式，ID 字段应该清空
      await waitFor(() => {
        const idInput = screen.getByLabelText('id')
        expect(idInput).toHaveValue('')
        expect(idInput).not.toBeDisabled()
      })

      // 标题应该从 "Edit" 变为 "New"
      expect(screen.getByText('New test record')).toBeInTheDocument()
    })
  })
})
