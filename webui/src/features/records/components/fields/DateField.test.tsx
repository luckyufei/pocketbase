/**
 * DateField 组件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { DateField } from './DateField'
import Flatpickr from 'react-flatpickr'

// Mock Flatpickr
vi.mock('react-flatpickr', () => ({
  default: vi.fn(({ value, onChange, options }) => {
    // 模拟 Flatpickr 组件
    const inputId = 'date-input'
    
    // 渲染一个简单的 input
    return React.createElement('input', {
      id: inputId,
      value: value || '',
      readOnly: true,
      'data-testid': 'flatpickr-input'
    })
  })
}))

// Mock Flatpickr CSS
vi.mock('flatpickr/dist/flatpickr.min.css', () => ({}))

describe('DateField', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('基本渲染', () => {
    it('应该渲染日期选择器', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByTestId('flatpickr-input')).toBeInTheDocument()
    })

    it('应该显示正确的字段图标 (ri-calendar-line)', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      const icon = screen.getByRole('img', { name: 'calendar-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示字段名称', () => {
      const field = { name: 'eventDate', type: 'date' as const, required: false }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByText('eventDate')).toBeInTheDocument()
    })
  })

  describe('required 属性', () => {
    it('field.required=true 时应该设置 required', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      const { container } = renderWithProviders(
        <DateField field={field} value="" onChange={mockOnChange} />
      )

      const formField = container.querySelector('.form-field')
      expect(formField).toHaveClass('required')
    })

    it('field.required=false 时不应该设置 required', () => {
      const field = { name: 'created', type: 'date' as const, required: false }

      const { container } = renderWithProviders(
        <DateField field={field} value="" onChange={mockOnChange} />
      )

      const formField = container.querySelector('.form-field')
      expect(formField).not.toHaveClass('required')
    })
  })

  describe('值绑定', () => {
    it('应该正确显示 value', () => {
      const field = { name: 'created', type: 'date' as const, required: true }
      const value = '2024-01-15 10:30:00'

      renderWithProviders(<DateField field={field} value={value} onChange={mockOnChange} />)

      const input = screen.getByTestId('flatpickr-input') as HTMLInputElement
      expect(input.value).toBe(value)
    })

    it('value 为空时应该显示空字符串', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByTestId('flatpickr-input') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('截断毫秒和时区部分', async () => {
      const field = { name: 'created', type: 'date' as const, required: true }
      const valueWithMs = '2024-01-15 10:30:00.123Z'

      renderWithProviders(
        <DateField field={field} value={valueWithMs} onChange={mockOnChange} />
      )

      await waitFor(() => {
        const input = screen.getByTestId('flatpickr-input') as HTMLInputElement
        // 应该截断为 '2024-01-15 10:30:00'
        expect(input.value).toBe('2024-01-15 10:30:00')
      })

      // onChange 应该被调用，传入截断后的值
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('2024-01-15 10:30:00')
      })
    })
  })

  describe('onChange 回调', () => {
    it('选择日期时应该调用 onChange', async () => {
      const field = { name: 'created', type: 'date' as const, required: true }
      const newValue = '2024-02-20 14:45:30'

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      // 模拟 Flatpickr onChange
      const mockFlatpickrInstance = Flatpickr as any
      const flatpickrCall = mockFlatpickrInstance.mock.calls[0]
      const onChangeCallback = flatpickrCall[1].onChange

      // 调用 onChange 回调
      onChangeCallback([new Date('2024-02-20T14:45:30')], newValue)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(newValue)
      })
    })
  })

  describe('清除按钮', () => {
    it('非必填且有值时应该显示清除按钮', () => {
      const field = { name: 'created', type: 'date' as const, required: false }
      const value = '2024-01-15 10:30:00'

      renderWithProviders(<DateField field={field} value={value} onChange={mockOnChange} />)

      const clearButton = screen.getByTitle('Clear')
      expect(clearButton).toBeInTheDocument()
    })

    it('点击清除按钮应该清空值', async () => {
      const field = { name: 'created', type: 'date' as const, required: false }
      const value = '2024-01-15 10:30:00'

      renderWithProviders(<DateField field={field} value={value} onChange={mockOnChange} />)

      const clearButton = screen.getByTitle('Clear')
      await userEvent.click(clearButton)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('')
      })
    })

    it('必填时不应该显示清除按钮', () => {
      const field = { name: 'created', type: 'date' as const, required: true }
      const value = '2024-01-15 10:30:00'

      renderWithProviders(<DateField field={field} value={value} onChange={mockOnChange} />)

      const clearButton = screen.queryByTitle('Clear')
      expect(clearButton).not.toBeInTheDocument()
    })

    it('值为空时不应该显示清除按钮', () => {
      const field = { name: 'created', type: 'date' as const, required: false }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      const clearButton = screen.queryByTitle('Clear')
      expect(clearButton).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('input 应该有正确的 id 和 label 关联', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      renderWithProviders(<DateField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByTestId('flatpickr-input')
      expect(screen.getByLabelText('created')).toBeInTheDocument()
    })

    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'created', type: 'date' as const, required: true }

      const { container } = renderWithProviders(
        <DateField field={field} value="" onChange={mockOnChange} />
      )

      const label = container.querySelector('label')
      expect(label?.getAttribute('for')).toBe('field_created')
    })

    it('清除按钮应该有正确的 title 和 aria-label', () => {
      const field = { name: 'created', type: 'date' as const, required: false }
      const value = '2024-01-15 10:30:00'

      renderWithProviders(<DateField field={field} value={value} onChange={mockOnChange} />)

      const clearButton = screen.getByTitle('Clear')
      expect(clearButton).toHaveAttribute('aria-label')
    })
  })
})
