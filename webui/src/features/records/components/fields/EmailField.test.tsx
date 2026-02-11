/**
 * EmailField 组件测试
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import { EmailField } from './EmailField'

describe('EmailField', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('基本渲染', () => {
    it('应该渲染 type="email" 的 input', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'email')
    })

    it('应该显示正确的字段图标 (ri-mail-line)', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const icon = screen.getByRole('img', { name: 'mail-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示字段名称', () => {
      const field = { name: 'contactEmail', type: 'email' as const, required: false }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByText('contactEmail')).toBeInTheDocument()
    })
  })

  describe('required 属性', () => {
    it('field.required=true 时应该设置 required 属性', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      expect(input).toHaveAttribute('required')
    })

    it('field.required=false 时不应该设置 required 属性', () => {
      const field = { name: 'email', type: 'email' as const, required: false }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      expect(input).not.toHaveAttribute('required')
    })
  })

  describe('值绑定', () => {
    it('应该正确显示 value', () => {
      const field = { name: 'email', type: 'email' as const, required: true }
      const value = 'test@example.com'

      renderWithProviders(<EmailField field={field} value={value} onChange={mockOnChange} />)

      const input = screen.getByLabelText('email') as HTMLInputElement
      expect(input.value).toBe(value)
    })

    it('value 为空时应该显示空字符串', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value={undefined} onChange={mockOnChange} />)

      const input = screen.getByLabelText('email') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('onChange 回调', () => {
    it('input 改变时应该调用 onChange', () => {
      const field = { name: 'email', type: 'email' as const, required: true }
      const newValue = 'new@example.com'

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      fireEvent.change(input, { target: { value: newValue } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(newValue)
    })

    it('连续输入应该多次调用 onChange', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      fireEvent.change(input, { target: { value: 't' } })
      fireEvent.change(input, { target: { value: 'te' } })
      fireEvent.change(input, { target: { value: 'tes' } })

      expect(mockOnChange).toHaveBeenCalledTimes(3)
      expect(mockOnChange).toHaveBeenLastCalledWith('tes')
    })
  })

  describe('HTML5 邮箱校验', () => {
    it('浏览器应该自动进行邮箱格式校验', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      expect(input).toHaveAttribute('type', 'email')

      // HTML5 type="email" 会自动进行格式校验
      // 无效格式在提交时会显示浏览器默认提示
    })
  })

  describe('Accessibility', () => {
    it('input 应该有正确的 id 和 label 关联', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      expect(input.id).toBe('field_email')
      expect(screen.getByLabelText('email')).toBeInTheDocument()
    })

    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'email', type: 'email' as const, required: true }

      renderWithProviders(<EmailField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('email')
      const label = input.closest('label')
      expect(label?.getAttribute('for')).toBe('field_email')
    })
  })
})
