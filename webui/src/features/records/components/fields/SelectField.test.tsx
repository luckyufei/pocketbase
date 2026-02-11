/**
 * SelectField Unit Tests
 * T9300: 创建 SelectField toggle 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectField } from './SelectField'
import type { CollectionField } from 'pocketbase'

// Helper to create a mock select field
function createSelectField(overrides: Partial<CollectionField> = {}): CollectionField {
  return {
    id: 'field_id',
    name: 'status',
    type: 'select',
    system: false,
    hidden: false,
    required: false,
    values: ['draft', 'published', 'archived'],
    maxSelect: 1,
    ...overrides,
  } as CollectionField
}

describe('SelectField', () => {
  describe('single select mode', () => {
    it('should render with label', () => {
      const field = createSelectField()
      const onChange = vi.fn()

      render(<SelectField field={field} value="" onChange={onChange} />)

      expect(screen.getByText('status')).toBeInTheDocument()
    })

    it('should render select trigger', () => {
      const field = createSelectField()
      const onChange = vi.fn()

      render(<SelectField field={field} value="" onChange={onChange} />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should show clear button for non-required field with value', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      expect(screen.getByTitle('Clear selection')).toBeInTheDocument()
    })

    it('should not show clear button for required field', () => {
      const field = createSelectField({ required: true })
      const onChange = vi.fn()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      expect(screen.queryByTitle('Clear selection')).not.toBeInTheDocument()
    })

    it('should not show clear button when no value selected', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value="" onChange={onChange} />)

      expect(screen.queryByTitle('Clear selection')).not.toBeInTheDocument()
    })

    it('should call onChange with empty string when clear button clicked', async () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      await user.click(screen.getByTitle('Clear selection'))

      expect(onChange).toHaveBeenCalledWith('')
    })

    it('should display selected value', () => {
      const field = createSelectField()
      const onChange = vi.fn()

      render(<SelectField field={field} value="published" onChange={onChange} />)

      expect(screen.getByText('published')).toBeInTheDocument()
    })
  })

  describe('multi select mode', () => {
    it('should render with maxSelect info', () => {
      const field = createSelectField({ maxSelect: 3 })
      const onChange = vi.fn()

      render(<SelectField field={field} value={['draft']} onChange={onChange} />)

      expect(screen.getByText(/Select up to 3 items/)).toBeInTheDocument()
    })

    it('should handle array values', () => {
      const field = createSelectField({ maxSelect: 3 })
      const onChange = vi.fn()

      render(<SelectField field={field} value={['draft', 'published']} onChange={onChange} />)

      // Component should render without errors
      expect(screen.getByText('status')).toBeInTheDocument()
    })
  })

  describe('required field', () => {
    it('should have required class when field is required', () => {
      const field = createSelectField({ required: true })
      const onChange = vi.fn()

      render(<SelectField field={field} value="" onChange={onChange} />)

      // Check for required class on form field container
      const container = screen.getByText('status').closest('[class*="required"]')
      expect(container).toBeInTheDocument()
    })
  })
})
