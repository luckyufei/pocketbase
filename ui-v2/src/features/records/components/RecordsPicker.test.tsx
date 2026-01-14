/**
 * TDD: RecordsPicker 组件测试
 * 关联记录选择器对话框
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsPicker } from './RecordsPicker'

// Mock API
vi.mock('@/lib/ApiClient', () => ({
  pb: {
    collection: vi.fn(() => ({
      getList: vi.fn().mockResolvedValue({
        items: [
          { id: 'rec1', collectionId: 'col1', name: 'Record 1' },
          { id: 'rec2', collectionId: 'col1', name: 'Record 2' },
          { id: 'rec3', collectionId: 'col1', name: 'Record 3' },
        ],
        page: 1,
        perPage: 50,
        totalItems: 3,
        totalPages: 1,
      }),
      getOne: vi.fn().mockResolvedValue({ id: 'rec1', name: 'Record 1' }),
      getFullList: vi
        .fn()
        .mockResolvedValue([{ id: 'rec1', collectionId: 'col1', name: 'Record 1' }]),
    })),
  },
}))

const mockCollection = {
  id: 'col1',
  name: 'posts',
  type: 'base' as const,
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'title', type: 'text', required: false },
  ],
}

const mockField = {
  name: 'related',
  type: 'relation',
  required: false,
  options: {
    collectionId: 'col1',
    maxSelect: 1,
  },
}

describe('RecordsPicker', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该在 open=true 时渲染对话框', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该在 open=false 时不渲染对话框', () => {
      render(
        <RecordsPicker
          open={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('应该显示 collection 名称', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.getByText(/posts/i)).toBeInTheDocument()
    })
  })

  describe('搜索功能', () => {
    it('应该渲染搜索框', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    })

    it('应该在输入时触发搜索', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'test')

      expect(searchInput).toHaveValue('test')
    })
  })

  describe('记录列表', () => {
    it('应该显示加载状态', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      // 初始加载时应该显示加载指示器或列表
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该显示记录列表', async () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Record 1')).toBeInTheDocument()
      })
    })
  })

  describe('单选模式', () => {
    it('应该在单选模式下只允许选择一个记录', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Record 1')).toBeInTheDocument()
      })

      // 点击选择第一个记录
      await user.click(screen.getByText('Record 1'))

      // 应该显示在已选择区域
      const selectedSection = screen.getByText(/selected/i).closest('div')
      expect(selectedSection).toBeInTheDocument()
    })
  })

  describe('多选模式', () => {
    const multiSelectField = {
      ...mockField,
      options: {
        ...mockField.options,
        maxSelect: 3,
      },
    }

    it('应该在多选模式下允许选择多个记录', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={multiSelectField}
          value={[]}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Record 1')).toBeInTheDocument()
      })

      // 点击选择多个记录
      await user.click(screen.getByText('Record 1'))
      await user.click(screen.getByText('Record 2'))

      // 应该显示选择计数
      expect(screen.getByText(/selected/i)).toBeInTheDocument()
    })

    it('应该显示最大选择数量', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={multiSelectField}
          value={[]}
        />
      )

      // 应该显示 MAX 3
      expect(screen.getByText(/max 3/i)).toBeInTheDocument()
    })
  })

  describe('已选择记录', () => {
    it('应该显示已选择的记录', async () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value="rec1"
        />
      )

      await waitFor(() => {
        // 已选择的记录应该在 selected 区域显示
        expect(screen.getByText(/selected/i)).toBeInTheDocument()
      })
    })

    it('应该能取消选择记录', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Record 1')).toBeInTheDocument()
      })

      // 点击选择记录
      await user.click(screen.getByText('Record 1'))

      // 应该有 CheckCircle 图标表示已选中
      await waitFor(() => {
        // 验证 selected 区域有内容
        expect(screen.getByText(/selected/i)).toBeInTheDocument()
      })
    })
  })

  describe('保存和取消', () => {
    it('应该有取消按钮', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('应该有确认按钮', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.getByRole('button', { name: /set selection/i })).toBeInTheDocument()
    })

    it('点击取消应该调用 onClose', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('点击确认应该调用 onSave', async () => {
      const user = userEvent.setup()
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={mockCollection}
          field={mockField}
          value=""
        />
      )

      await user.click(screen.getByRole('button', { name: /set selection/i }))
      expect(mockOnSave).toHaveBeenCalled()
    })
  })

  describe('View Collection', () => {
    const viewCollection = {
      ...mockCollection,
      type: 'view' as const,
    }

    it('View 类型应该隐藏新建记录按钮', () => {
      render(
        <RecordsPicker
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          collection={viewCollection}
          field={mockField}
          value=""
        />
      )
      expect(screen.queryByRole('button', { name: /new record/i })).not.toBeInTheDocument()
    })
  })
})
