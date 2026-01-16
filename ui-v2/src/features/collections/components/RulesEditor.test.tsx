/**
 * RulesEditor 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { RulesEditor } from './RulesEditor'

describe('RulesEditor', () => {
  const mockRules = {
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
  }

  it('should render all rule inputs', () => {
    render(<RulesEditor rules={mockRules} onChange={() => {}} />)

    expect(screen.getByText('List')).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('should display rule values', () => {
    const rulesWithValues = {
      ...mockRules,
      listRule: '@request.auth.id != ""',
    }
    render(<RulesEditor rules={rulesWithValues} onChange={() => {}} />)

    expect(screen.getByDisplayValue('@request.auth.id != ""')).toBeInTheDocument()
  })

  it('should call onChange when rule is modified', () => {
    const handleChange = vi.fn()
    render(<RulesEditor rules={mockRules} onChange={handleChange} />)

    // 获取第一个非禁用的 textarea
    const textareas = screen.getAllByRole('textbox')
    const enabledTextarea = textareas.find((t) => !t.hasAttribute('disabled'))
    if (enabledTextarea) {
      fireEvent.change(enabledTextarea, { target: { value: 'new rule' } })
      expect(handleChange).toHaveBeenCalled()
    }
  })

  it('should show lock icon for locked rules', () => {
    const lockedRules = {
      ...mockRules,
      listRule: null, // null 表示锁定（只有管理员可访问）
    }
    render(<RulesEditor rules={lockedRules} onChange={() => {}} />)

    // 应该显示锁定状态
    expect(screen.getByText(/admin only/i)).toBeInTheDocument()
  })
})
