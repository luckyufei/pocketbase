/**
 * PasswordField 组件测试
 * 非 Auth Collection 中的 password 字段
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('基本渲染', () => {
    it('应该渲染 type="password" 的 input', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'password')
    })

    it('应该显示正确的字段图标 (ri-lock-password-line)', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const icon = screen.getByRole('img', { name: 'lock-password-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示字段名称', () => {
      const field = { name: 'userPassword', type: 'password' as const, required: false }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByText('userPassword')).toBeInTheDocument()
    })
  })

  describe('required 属性', () => {
    it('field.required=true 时应该设置 required 属性', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      expect(input).toHaveAttribute('required')
    })

    it('field.required=false 时不应该设置 required 属性', () => {
      const field = { name: 'password', type: 'password' as const, required: false }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      expect(input).not.toHaveAttribute('required')
    })
  })

  describe('值绑定', () => {
    it('应该正确显示 value', () => {
      const field = { name: 'password', type: 'password' as const, required: true }
      const value = 'secret123'

      renderWithProviders(<PasswordField field={field} value={value} onChange={mockOnChange} />)

      const input = screen.getByLabelText('password') as HTMLInputElement
      expect(input.value).toBe(value)
    })

    it('value 为空时应该显示空字符串', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value={undefined} onChange={mockOnChange} />)

      const input = screen.getByLabelText('password') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('onChange 回调', () => {
    it('input 改变时应该调用 onChange', () => {
      const field = { name: 'password', type: 'password' as const, required: true }
      const newValue = 'newpassword456'

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      fireEvent.change(input, { target: { value: newValue } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(newValue)
    })

    it('连续输入应该多次调用 onChange', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      fireEvent.change(input, { target: { value: 's' } })
      fireEvent.change(input, { target: { value: 'se' } })
      fireEvent.change(input, { target: { value: 'sec' } })

      expect(mockOnChange).toHaveBeenCalledTimes(3)
      expect(mockOnChange).toHaveBeenLastCalledWith('sec')
    })
  })

  describe('autocomplete 属性', () => {
    it('应该设置 autocomplete="new-password"', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      expect(input).toHaveAttribute('autocomplete', 'new-password')
    })
  })

  describe('Accessibility', () => {
    it('input 应该有正确的 id 和 label 关联', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      expect(input.id).toBe('field_password')
      expect(screen.getByLabelText('password')).toBeInTheDocument()
    })

    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'password', type: 'password' as const, required: true }

      renderWithProviders(<PasswordField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('password')
      const label = input.closest('label')
      expect(label?.getAttribute('for')).toBe('field_password')
    })
  })
})
