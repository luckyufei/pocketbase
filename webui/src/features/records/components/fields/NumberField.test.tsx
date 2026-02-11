/**
 * NumberField Unit Tests
 * T8400: 创建 NumberField 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberField } from './NumberField'
import type { CollectionField } from 'pocketbase'

// Helper to create a mock number field
function createNumberField(overrides: Partial<CollectionField> = {}): CollectionField {
  return {
    id: 'field_id',
    name: 'count',
    type: 'number',
    system: false,
    hidden: false,
    required: false,
    min: null,
    max: null,
    ...overrides,
  } as CollectionField
}

describe('NumberField', () => {
  describe('rendering', () => {
    it('should render with label', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByText('count')).toBeInTheDocument()
    })

    it('should render number input', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })

    it('should have type="number"', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
    })

    it('should display current value', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={42} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveValue(42)
    })

    it('should show empty input when value is undefined', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveValue(null)
    })
  })

  describe('input handling', () => {
    it('should call onChange with number when typing', async () => {
      const field = createNumberField()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      await user.type(screen.getByRole('spinbutton'), '123')

      // Each keystroke triggers onChange
      expect(onChange).toHaveBeenCalled()
    })

    it('should call onChange with parsed number', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '42' } })

      expect(onChange).toHaveBeenCalledWith(42)
    })

    it('should call onChange with undefined when cleared', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={42} onChange={onChange} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })

      expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('should handle decimal numbers', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3.14' } })

      expect(onChange).toHaveBeenCalledWith(3.14)
    })

    it('should handle negative numbers', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-10' } })

      expect(onChange).toHaveBeenCalledWith(-10)
    })
  })

  describe('validation attributes', () => {
    it('should have required attribute when required', () => {
      const field = createNumberField({ required: true })
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveAttribute('required')
    })

    it('should have min attribute when min is set', () => {
      const field = createNumberField({ min: 0 })
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveAttribute('min', '0')
    })

    it('should have max attribute when max is set', () => {
      const field = createNumberField({ max: 100 })
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveAttribute('max', '100')
    })

    it('should have step="any" for decimal support', () => {
      const field = createNumberField()
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', 'any')
    })
  })

  describe('required field', () => {
    it('should have required class when field is required', () => {
      const field = createNumberField({ required: true })
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      const container = document.querySelector('.required')
      expect(container).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have id matching label htmlFor', () => {
      const field = createNumberField({ name: 'test_number' })
      const onChange = vi.fn()

      render(<NumberField field={field} value={undefined} onChange={onChange} />)

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('id', 'field_test_number')
    })
  })
})
