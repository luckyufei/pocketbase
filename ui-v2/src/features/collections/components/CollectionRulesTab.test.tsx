// TDD: CollectionRulesTab 组件测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CollectionRulesTab } from './CollectionRulesTab'

describe('CollectionRulesTab', () => {
  const mockCollection = {
    id: 'c1',
    name: 'posts',
    type: 'base' as const,
    fields: [
      { id: 'f1', name: 'title', type: 'text' },
      { id: 'f2', name: 'content', type: 'editor' },
    ],
    indexes: [],
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
  }

  const mockAuthCollection = {
    ...mockCollection,
    id: 'c2',
    name: 'users',
    type: 'auth' as const,
    authRule: '',
    manageRule: null,
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe('基础规则', () => {
    it('应该渲染 List/Search rule 字段', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/list\/search rule/i)).toBeInTheDocument()
    })

    it('应该渲染 View rule 字段', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/view rule/i)).toBeInTheDocument()
    })

    it('应该渲染 Create rule 字段', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/create rule/i)).toBeInTheDocument()
    })

    it('应该渲染 Update rule 字段', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/update rule/i)).toBeInTheDocument()
    })

    it('应该渲染 Delete rule 字段', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/delete rule/i)).toBeInTheDocument()
    })
  })

  describe('View collection', () => {
    it('View 类型不应该显示 Create/Update/Delete 规则', () => {
      const viewCollection = { ...mockCollection, type: 'view' as const }
      render(<CollectionRulesTab collection={viewCollection} onChange={mockOnChange} />)

      expect(screen.getByText(/list\/search rule/i)).toBeInTheDocument()
      expect(screen.getByText(/view rule/i)).toBeInTheDocument()
      expect(screen.queryByText(/create rule/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/update rule/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/delete rule/i)).not.toBeInTheDocument()
    })
  })

  describe('Auth collection 额外规则', () => {
    it('Auth 类型应该显示额外规则按钮', () => {
      render(<CollectionRulesTab collection={mockAuthCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/additional auth collection rules/i)).toBeInTheDocument()
    })

    it('点击额外规则按钮应该显示 Authentication rule', async () => {
      const user = userEvent.setup()
      render(<CollectionRulesTab collection={mockAuthCollection} onChange={mockOnChange} />)

      await user.click(screen.getByText(/additional auth collection rules/i))

      await waitFor(() => {
        expect(screen.getByText(/authentication rule/i)).toBeInTheDocument()
      })
    })

    it('点击额外规则按钮应该显示 Manage rule', async () => {
      const user = userEvent.setup()
      render(<CollectionRulesTab collection={mockAuthCollection} onChange={mockOnChange} />)

      await user.click(screen.getByText(/additional auth collection rules/i))

      await waitFor(() => {
        expect(screen.getByText(/manage rule/i)).toBeInTheDocument()
      })
    })
  })

  describe('帮助信息', () => {
    it('应该显示 Show available fields 按钮', () => {
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)
      expect(screen.getByText(/show available fields/i)).toBeInTheDocument()
    })

    it('点击后应该显示可用字段列表', async () => {
      const user = userEvent.setup()
      render(<CollectionRulesTab collection={mockCollection} onChange={mockOnChange} />)

      await user.click(screen.getByText(/show available fields/i))

      await waitFor(() => {
        expect(screen.getByText('title')).toBeInTheDocument()
        expect(screen.getByText('content')).toBeInTheDocument()
      })
    })
  })
})
