/**
 * UrlField 组件测试
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import { UrlField } from './UrlField'

describe('UrlField', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('基本渲染', () => {
    it('应该渲染 type="url" 的 input', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'url')
    })

    it('应该显示正确的字段图标 (ri-link)', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const icon = screen.getByRole('img', { name: 'link' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示字段名称', () => {
      const field = { name: 'profileUrl', type: 'url' as const, required: false }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      expect(screen.getByText('profileUrl')).toBeInTheDocument()
    })
  })

  describe('required 属性', () => {
    it('field.required=true 时应该设置 required 属性', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      expect(input).toHaveAttribute('required')
    })

    it('field.required=false 时不应该设置 required 属性', () => {
      const field = { name: 'website', type: 'url' as const, required: false }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      expect(input).not.toHaveAttribute('required')
    })
  })

  describe('值绑定', () => {
    it('应该正确显示 value', () => {
      const field = { name: 'website', type: 'url' as const, required: true }
      const value = 'https://example.com'

      renderWithProviders(<UrlField field={field} value={value} onChange={mockOnChange} />)

      const input = screen.getByLabelText('website') as HTMLInputElement
      expect(input.value).toBe(value)
    })

    it('value 为空时应该显示空字符串', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value={undefined} onChange={mockOnChange} />)

      const input = screen.getByLabelText('website') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('onChange 回调', () => {
    it('input 改变时应该调用 onChange', () => {
      const field = { name: 'website', type: 'url' as const, required: true }
      const newValue = 'https://newexample.com'

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      fireEvent.change(input, { target: { value: newValue } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(newValue)
    })

    it('连续输入应该多次调用 onChange', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      fireEvent.change(input, { target: { value: 'h' } })
      fireEvent.change(input, { target: { value: 'ht' } })
      fireEvent.change(input, { target: { value: 'htt' } })

      expect(mockOnChange).toHaveBeenCalledTimes(3)
      expect(mockOnChange).toHaveBeenLastCalledWith('htt')
    })
  })

  describe('HTML5 URL 校验', () => {
    it('浏览器应该自动进行 URL 格式校验', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      expect(input).toHaveAttribute('type', 'url')

      // HTML5 type="url" 会自动进行格式校验
      // 无效格式在提交时会显示浏览器默认提示
    })
  })

  describe('Accessibility', () => {
    it('input 应该有正确的 id 和 label 关联', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      expect(input.id).toBe('field_website')
      expect(screen.getByLabelText('website')).toBeInTheDocument()
    })

    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'website', type: 'url' as const, required: true }

      renderWithProviders(<UrlField field={field} value="" onChange={mockOnChange} />)

      const input = screen.getByLabelText('website')
      const label = input.closest('label')
      expect(label?.getAttribute('for')).toBe('field_website')
    })
  })
})
