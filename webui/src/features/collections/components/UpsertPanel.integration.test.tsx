import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UpsertPanel from './UpsertPanel'
import CollectionUpdateConfirm from './CollectionUpdateConfirm'

// Mock API
const mockSaveCollection = vi.fn()
vi.mock('../../../lib/api', () => ({
  saveCollection: mockSaveCollection,
  deleteCollection: vi.fn(),
  truncateCollection: vi.fn(),
  duplicateCollection: vi.fn(),
  getScaffolds: vi.fn(() => Promise.resolve({
    base: {
      type: 'base',
      fields: [
        { type: 'text', name: 'id', required: true, system: true },
      ],
      indexes: [],
    },
    auth: {
      type: 'auth',
      fields: [
        { type: 'text', name: 'id', required: true, system: true },
        { type: 'password', name: 'password', required: true, system: true },
        { type: 'text', name: 'tokenKey', required: true, system: true },
      ],
      indexes: [],
    },
  })),
}))

describe('UpsertPanel Integration Tests', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockSaveCollection.mockClear()
  })

  afterEach(() => {
    queryClient.clear()
  })

  const renderUpsertPanel = (props: any = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <UpsertPanel
          open={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onTruncate={vi.fn()}
          onDuplicate={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    )
  }

  describe('1. 新建流程', () => {
    it('新建模式下应该自动添加 created 和 updated 字段', async () => {
      const handleSave = vi.fn()
      renderUpsertPanel({ onSave: handleSave })

      await waitFor(() => {
        expect(screen.getByText(/created/i)).toBeInTheDocument()
        expect(screen.getByText(/updated/i)).toBeInTheDocument()
      })
    })

    it('新建模式下应该可以添加 Secret 字段', async () => {
      renderUpsertPanel()

      // 点击 "New field" 按钮
      const newFieldButton = screen.getByRole('button', { name: /new field/i })
      await userEvent.click(newFieldButton)

      // 选择 Secret 类型
      const secretOption = screen.getByText(/secret/i)
      await userEvent.click(secretOption)

      // 验证 Secret 字段已添加
      await waitFor(() => {
        const secretField = screen.getByText(/secret/i)
        expect(secretField).toBeInTheDocument()
      })
    })
  })

  describe('2. 编辑流程 - 变更检测', () => {
    const mockCollection = {
      id: 'test-id',
      name: 'old-name',
      type: 'base' as const,
      fields: [
        { id: 'f1', name: 'title', type: 'text', required: true },
      ],
      indexes: [],
      createRule: '',
      updateRule: '',
      deleteRule: '',
      listRule: '',
      viewRule: '',
    }

    it('修改字段后应该显示变更确认面板', async () => {
      const handleSave = vi.fn()
      renderUpsertPanel({
        collection: mockCollection,
        onSave: handleSave,
      })

      // 修改字段名称
      await waitFor(() => {
        const fieldInput = screen.getByDisplayValue('title')
        if (fieldInput) {
          fireEvent.change(fieldInput, { target: { value: 'new-title' } })
        }
      })

      // 点击保存
      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      // 应该显示确认面板
      await waitFor(() => {
        expect(screen.getByText(/confirm collection changes/i)).toBeInTheDocument()
      })
    })

    it('应该检测字段重命名', async () => {
      const handleSave = vi.fn()
      renderUpsertPanel({
        collection: mockCollection,
        onSave: handleSave,
      })

      // 重命名字段
      await waitFor(() => {
        const fieldInput = screen.getByDisplayValue('title')
        if (fieldInput) {
          fireEvent.change(fieldInput, { target: { value: 'new-title' } })
        }
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        const confirmPanel = screen.getByText(/confirm collection changes/i)
        expect(confirmPanel).toBeInTheDocument()
      })
    })

    it('应该检测字段删除', async () => {
      const handleSave = vi.fn()
      renderUpsertPanel({
        collection: {
          ...mockCollection,
          fields: [
            { id: 'f1', name: 'title', type: 'text', required: true },
            { id: 'f2', name: 'description', type: 'text', required: false },
          ],
        },
        onSave: handleSave,
      })

      // 删除第二个字段
      const deleteButtons = screen.getAllByRole('button', { name: '' })
      if (deleteButtons.length > 1) {
        await userEvent.click(deleteButtons[1])
      }

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/removed fields/i)).toBeInTheDocument()
      })
    })
  })

  describe('3. Secret 字段配置', () => {
    it('Secret 字段选项面板应该显示 maxSize 输入框', async () => {
      renderUpsertPanel()

      // 添加 Secret 字段
      const newFieldButton = screen.getByRole('button', { name: /new field/i })
      await userEvent.click(newFieldButton)

      const secretOption = screen.getByText(/secret/i)
      await userEvent.click(secretOption)

      // 打开字段选项
      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await userEvent.click(settingsButton)

      // 验证 maxSize 输入框
      await waitFor(() => {
        const maxSizeInput = screen.getByLabelText(/max size/i)
        expect(maxSizeInput).toBeInTheDocument()
      })
    })

    it('应该可以修改 Secret 字段的 maxSize', async () => {
      renderUpsertPanel()

      // 添加 Secret 字段并打开选项
      const newFieldButton = screen.getByRole('button', { name: /new field/i })
      await userEvent.click(newFieldButton)

      const secretOption = screen.getByText(/secret/i)
      await userEvent.click(secretOption)

      const settingsButton = screen.getByRole('button', { name: /settings/i })
      await userEvent.click(settingsButton)

      // 修改 maxSize
      await waitFor(async () => {
        const maxSizeInput = screen.getByLabelText(/max size/i) as HTMLInputElement
        await userEvent.clear(maxSizeInput)
        await userEvent.type(maxSizeInput, '8192')

        expect(maxSizeInput.value).toBe('8192')
      })
    })
  })

  describe('4. 默认字段', () => {
    it('新建 Auth 类型 Collection 应该包含系统字段', async () => {
      renderUpsertPanel()

      // 切换到 Auth 类型
      const typeSelect = screen.getByLabelText(/type/i)
      await userEvent.click(typeSelect)

      const authOption = screen.getByText(/auth/i)
      await userEvent.click(authOption)

      await waitFor(() => {
        expect(screen.getByText(/password/i)).toBeInTheDocument()
        expect(screen.getByText(/tokenKey/i)).toBeInTheDocument()
      })
    })

    it('从 Base 切换为 Auth 应该保留已有字段', async () => {
      renderUpsertPanel()

      // 添加一个自定义字段
      const newFieldButton = screen.getByRole('button', { name: /new field/i })
      await userEvent.click(newFieldButton)

      const textOption = screen.getByText(/text/i)
      await userEvent.click(textOption)

      // 切换到 Auth 类型
      const typeSelect = screen.getByLabelText(/type/i)
      await userEvent.click(typeSelect)

      const authOption = screen.getByText(/auth/i)
      await userEvent.click(authOption)

      await waitFor(() => {
        expect(screen.getByText(/text/i)).toBeInTheDocument()
        expect(screen.getByText(/password/i)).toBeInTheDocument()
      })
    })
  })

  describe('5. Collection 重命名和索引更新', () => {
    it('Collection 重命名时索引应该自动更新', async () => {
      const mockCollectionWithIndex = {
        ...mockCollection,
        indexes: ['CREATE INDEX idx_old_name_title ON `old_name` (`title`)'],
      }

      const handleSave = vi.fn()
      renderUpsertPanel({
        collection: mockCollectionWithIndex,
        onSave: handleSave,
      })

      // 修改 Collection 名称
      const nameInput = screen.getByDisplayValue('old-name')
      await userEvent.clear(nameInput)
      await userEvent.type(nameInput, 'new-name')

      // 保存并确认
      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      // 验证索引已更新
      await waitFor(() => {
        const updatedIndexes = handleSave.mock.calls[0]?.[0]?.indexes || []
        const hasUpdatedIndex = updatedIndexes.some((idx: string) =>
          idx.includes('new-name') && idx.includes('idx_new_name_')
        )
        expect(hasUpdatedIndex).toBe(true)
      })
    })
  })

  describe('6. 表单验证', () => {
    it('Collection 名称为空时应该显示错误', async () => {
      renderUpsertPanel()

      const nameInput = screen.getByLabelText(/name/i)
      await userEvent.clear(nameInput)

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        const errorMessage = screen.getByText(/cannot be blank/i)
        expect(errorMessage).toBeInTheDocument()
      })
    })

    it('字段名重复时应该显示错误', async () => {
      renderUpsertPanel()

      // 添加两个同名字段
      const newFieldButton = screen.getByRole('button', { name: /new field/i })
      await userEvent.click(newFieldButton)

      const textOption = screen.getByText(/text/i)
      await userEvent.click(textOption)

      const nameInputs = screen.getAllByLabelText(/field name/i)
      if (nameInputs.length > 0) {
        await userEvent.clear(nameInputs[0])
        await userEvent.type(nameInputs[0], 'duplicate')

        await userEvent.click(newFieldButton)
        await userEvent.click(textOption)

        // 第二个字段也命名为 duplicate
        const allNameInputs = screen.getAllByLabelText(/field name/i)
        if (allNameInputs.length > 1) {
          await userEvent.clear(allNameInputs[1])
          await userEvent.type(allNameInputs[1], 'duplicate')

          // 应该显示重复错误
          await waitFor(() => {
            const error = screen.getByText(/duplicate field name/i)
            expect(error).toBeInTheDocument()
          })
        }
      }
    })
  })
})
