/**
 * BoolField Unit Tests
 * T8500: 创建 BoolField 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoolField } from './BoolField'

// Helper to create a mock bool field
function createBoolField(overrides = {}) {
  return {
    name: 'active',
    type: 'bool',
    required: false,
    ...overrides,
  }
}

describe('BoolField', () => {
  describe('rendering', () => {
    it('should render with label', () => {
      const field = createBoolField()
      const onChange = vi.fn()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('should render checkbox', () => {
      const field = createBoolField()
      const onChange = vi.fn()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('should be unchecked when value is false', () => {
      const field = createBoolField()
      const onChange = vi.fn()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('should be checked when value is true', () => {
      const field = createBoolField()
      const onChange = vi.fn()

      render(<BoolField field={field} value={true} onChange={onChange} />)

      expect(screen.getByRole('checkbox')).toBeChecked()
    })
  })

  describe('interaction', () => {
    it('should call onChange with true when unchecked checkbox is clicked', async () => {
      const field = createBoolField()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      await user.click(screen.getByRole('checkbox'))

      expect(onChange).toHaveBeenCalledWith(true)
    })

    it('should call onChange with false when checked checkbox is clicked', async () => {
      const field = createBoolField()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<BoolField field={field} value={true} onChange={onChange} />)

      await user.click(screen.getByRole('checkbox'))

      expect(onChange).toHaveBeenCalledWith(false)
    })

    it('should toggle on label click', async () => {
      const field = createBoolField({ name: 'is_published' })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      await user.click(screen.getByText('is_published'))

      expect(onChange).toHaveBeenCalledWith(true)
    })
  })

  describe('accessibility', () => {
    it('should have aria-label', () => {
      const field = createBoolField({ name: 'is_active' })
      const onChange = vi.fn()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label', 'is_active')
    })

    it('should be keyboard accessible', async () => {
      const field = createBoolField()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      const checkbox = screen.getByRole('checkbox')
      checkbox.focus()

      await user.keyboard(' ')

      expect(onChange).toHaveBeenCalledWith(true)
    })
  })

  describe('different field names', () => {
    it('should display field name as label', () => {
      const field = createBoolField({ name: 'enable_notifications' })
      const onChange = vi.fn()

      render(<BoolField field={field} value={false} onChange={onChange} />)

      expect(screen.getByText('enable_notifications')).toBeInTheDocument()
    })
  })
})
