/**
 * CollectionFieldsTab 测试
 * TDD: 绿灯阶段 - 修复测试以匹配实现
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectionFieldsTab } from './CollectionFieldsTab'

// Mock collection data
const mockCollection = {
  id: 'test_collection',
  name: 'test',
  type: 'base' as const,
  fields: [
    { id: 'f1', name: 'title', type: 'text', required: true, system: false },
    { id: 'f2', name: 'count', type: 'number', required: false, system: false },
    { id: 'f3', name: 'id', type: 'text', required: true, system: true },
  ],
  indexes: [],
}

describe('CollectionFieldsTab', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe('字段列表展示', () => {
    it('应该显示所有字段', () => {
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      expect(screen.getByDisplayValue('title')).toBeInTheDocument()
      expect(screen.getByDisplayValue('count')).toBeInTheDocument()
      expect(screen.getByDisplayValue('id')).toBeInTheDocument()
    })

    it('应该显示字段类型标签', () => {
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 使用 getAllByText 因为有多个相同类型的字段
      const textBadges = screen.getAllByText('text')
      expect(textBadges.length).toBeGreaterThan(0)
      expect(screen.getByText('number')).toBeInTheDocument()
    })

    it('应该区分系统字段和用户字段', () => {
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 系统字段的输入框应该被禁用
      const idInput = screen.getByDisplayValue('id')
      expect(idInput).toBeDisabled()

      // 用户字段应该可编辑
      const titleInput = screen.getByDisplayValue('title')
      expect(titleInput).not.toBeDisabled()
    })
  })

  describe('新增字段', () => {
    it('应该显示新增字段按钮', () => {
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /new field/i })).toBeInTheDocument()
    })

    it('点击新增按钮应该显示字段类型菜单', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /new field/i }))

      // 应该显示所有字段类型选项
      await waitFor(() => {
        expect(screen.getByText('Plain text')).toBeInTheDocument()
        expect(screen.getByText('Number')).toBeInTheDocument()
        expect(screen.getByText('Bool')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
        expect(screen.getByText('Relation')).toBeInTheDocument()
      })
    })

    it('选择字段类型后应该添加新字段', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /new field/i }))
      await user.click(screen.getByText('Plain text'))

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ type: 'text', name: expect.any(String) }),
          ]),
        })
      )
    })
  })

  describe('编辑字段', () => {
    it('应该能修改字段名称', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      const titleInput = screen.getByDisplayValue('title')
      await user.clear(titleInput)
      await user.type(titleInput, 'new_title')

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('点击设置按钮应该展开字段选项', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 找到第一个字段的设置按钮
      const settingsButtons = screen.getAllByRole('button', { name: /settings/i })
      await user.click(settingsButtons[0])

      // 应该显示字段选项 - 使用 getAllByText 因为可能有多个
      await waitFor(() => {
        const nonemptyLabels = screen.getAllByText(/nonempty/i)
        expect(nonemptyLabels.length).toBeGreaterThan(0)
      })
    })
  })

  describe('删除字段', () => {
    it('被删除的字段应该显示恢复按钮', async () => {
      const collectionWithDeleted = {
        ...mockCollection,
        fields: [
          { id: 'f1', name: 'title', type: 'text', required: true, system: false, _toDelete: true },
        ],
      }

      render(<CollectionFieldsTab collection={collectionWithDeleted} onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument()
    })

    it('点击恢复按钮应该取消删除标记', async () => {
      const user = userEvent.setup()
      const collectionWithDeleted = {
        ...mockCollection,
        fields: [
          { id: 'f1', name: 'title', type: 'text', required: true, system: false, _toDelete: true },
        ],
      }

      render(<CollectionFieldsTab collection={collectionWithDeleted} onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /restore/i }))

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.arrayContaining([expect.objectContaining({ id: 'f1', _toDelete: false })]),
        })
      )
    })
  })

  describe('字段选项', () => {
    it('展开字段后应该显示选项区域', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 展开第一个字段
      const settingsButtons = screen.getAllByRole('button', { name: /settings/i })
      await user.click(settingsButtons[0])

      // 应该显示 Hidden 选项
      await waitFor(() => {
        expect(screen.getByText('Hidden')).toBeInTheDocument()
      })
    })

    it('展开字段后应该显示 Presentable 选项', async () => {
      const user = userEvent.setup()
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 展开第一个字段
      const settingsButtons = screen.getAllByRole('button', { name: /settings/i })
      await user.click(settingsButtons[0])

      // 应该显示 Presentable 选项
      await waitFor(() => {
        expect(screen.getByText('Presentable')).toBeInTheDocument()
      })
    })
  })

  describe('索引管理', () => {
    it('应该显示索引列表区域', () => {
      render(<CollectionFieldsTab collection={mockCollection} onChange={mockOnChange} />)

      // 使用更精确的选择器
      expect(screen.getByText('Indexes')).toBeInTheDocument()
    })
  })
})
