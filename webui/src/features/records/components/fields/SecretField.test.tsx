/**
 * SecretField 组件测试
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import { SecretField } from './SecretField'

describe('SecretField', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('基本渲染', () => {
    it('应该渲染 SecretInput 组件', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'password')
    })

    it('应该显示正确的字段图标 (ri-shield-keyhole-line)', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const icon = screen.getByRole('img', { name: 'shield-keyhole-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示字段名称', () => {
      const field = { name: 'secretKey', type: 'secret' as const, required: false }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByText('secretKey')).toBeInTheDocument()
    })
  })

  describe('required 属性', () => {
    it('field.required=true 时应该设置 required 属性', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      expect(input).toHaveAttribute('required')
    })

    it('field.required=false 时不应该设置 required 属性', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: false }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      expect(input).not.toHaveAttribute('required')
    })
  })

  describe('值绑定', () => {
    it('应该正确显示 value', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }
      const value = 'sk_test_1234567890'

      renderWithProviders(<SecretField field={field} value={value} onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey') as HTMLInputElement
      expect(input.value).toBe(value)
    })

    it('value 为空时应该显示空字符串', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value={undefined} onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('onChange 回调', () => {
    it('input 改变时应该调用 onChange', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }
      const newValue = 'sk_new_key_123'

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      fireEvent.change(input, { target: { value: newValue } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(newValue)
    })

    it('连续输入应该多次调用 onChange', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      fireEvent.change(input, { target: { value: 's' } })
      fireEvent.change(input, { target: { value: 'sk' } })
      fireEvent.change(input, { target: { value: 'sk_' } })

      expect(mockOnChange).toHaveBeenCalledTimes(3)
      expect(mockOnChange).toHaveBeenLastCalledWith('sk_')
    })
  })

  describe('密码显示/隐藏功能', () => {
    it('应该有切换密码可见性的按钮', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="secret123" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey') as HTMLInputElement
      expect(input.type).toBe('password')

      // 点击显示按钮
      const toggleButton = screen.getByRole('button', { name: /show/i })
      fireEvent.click(toggleButton)

      // 密码应该变为可见
      expect(input.type).toBe('text')
    })

    it('再次点击应该隐藏密码', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="secret123" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey') as HTMLInputElement

      // 第一次点击：显示
      const showButton = screen.getByRole('button', { name: /show/i })
      fireEvent.click(showButton)
      expect(input.type).toBe('text')

      // 第二次点击：隐藏
      const hideButton = screen.getByRole('button', { name: /hide/i })
      fireEvent.click(hideButton)
      expect(input.type).toBe('password')
    })
  })

  describe('Accessibility', () => {
    it('input 应该有正确的 id 和 label 关联', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      expect(input.id).toBe('field_apiKey')
      expect(screen.getByLabelText('apiKey')).toBeInTheDocument()
    })

    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('apiKey')
      const label = input.closest('label')
      expect(label?.getAttribute('for')).toBe('field_apiKey')
    })

    it('切换按钮应该有正确的 aria-label', () => {
      const field = { name: 'apiKey', type: 'secret' as const, required: true }

      renderWithProviders(<SecretField field={field} value="secret" onChange={mockOnChange} />)

      const toggleButton = screen.getByRole('button', { name: /show/i })
      expect(toggleButton).toHaveAttribute('aria-label')
    })
  })
})
