/**
 * TextField Unit Tests
 * T8300: 创建 TextField 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from './TextField'
import type { CollectionField, RecordModel } from 'pocketbase'

// Helper to create a mock text field
function createTextField(overrides: Partial<CollectionField> = {}): CollectionField {
  return {
    id: 'field_id',
    name: 'title',
    type: 'text',
    system: false,
    hidden: false,
    required: false,
    min: null,
    max: null,
    pattern: '',
    autogeneratePattern: '',
    ...overrides,
  } as CollectionField
}

// Helper to create a mock record
function createRecord(overrides: Partial<RecordModel> = {}): RecordModel {
  return {
    id: 'record_id',
    collectionId: 'collection_id',
    collectionName: 'test',
    created: '2024-01-01',
    updated: '2024-01-01',
    ...overrides,
  } as RecordModel
}

describe('TextField', () => {
  describe('rendering', () => {
    it('should render with label', () => {
      const field = createTextField()
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      expect(screen.getByText('title')).toBeInTheDocument()
    })

    it('should render textarea element', () => {
      const field = createTextField()
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should display current value', () => {
      const field = createTextField()
      const onChange = vi.fn()

      render(<TextField field={field} value="Hello World" onChange={onChange} />)

      expect(screen.getByRole('textbox')).toHaveValue('Hello World')
    })
  })

  describe('input handling', () => {
    it('should call onChange when typing', async () => {
      const field = createTextField()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<TextField field={field} value="" onChange={onChange} />)

      await user.type(screen.getByRole('textbox'), 'test')

      expect(onChange).toHaveBeenCalled()
    })

    it('should pass correct value to onChange', () => {
      const field = createTextField()
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } })

      expect(onChange).toHaveBeenCalledWith('new value')
    })

    it('should handle empty value as empty string', () => {
      const field = createTextField()
      const onChange = vi.fn()

      // When value is null/undefined, should default to empty string
      render(<TextField field={field} value={null as any} onChange={onChange} />)

      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })

  describe('required field', () => {
    it('should have required class when field is required and no autogenerate', () => {
      const field = createTextField({ required: true, autogeneratePattern: '' })
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      // FormField should have required class
      const container = document.querySelector('.required')
      expect(container).toBeInTheDocument()
    })

    it('should not be required when field has autogenerate pattern and no original', () => {
      const field = createTextField({ required: true, autogeneratePattern: '{random}' })
      const onChange = vi.fn()

      // No original means new record
      render(<TextField field={field} value="" onChange={onChange} />)

      // Should not have required attribute because autogenerate will fill it
      expect(screen.getByRole('textbox')).not.toHaveAttribute('required')
    })

    it('should be required when editing existing record with autogenerate', () => {
      const field = createTextField({ required: true, autogeneratePattern: '{random}' })
      const original = createRecord({ id: 'existing_id' })
      const onChange = vi.fn()

      render(<TextField field={field} original={original} value="existing" onChange={onChange} />)

      // When editing existing record, autogenerate doesn't apply
      expect(screen.getByRole('textbox')).toHaveAttribute('required')
    })
  })

  describe('autogenerate placeholder', () => {
    it('should show autogenerate placeholder for new record with pattern', () => {
      const field = createTextField({ autogeneratePattern: '{random}' })
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Leave empty to autogenerate...')
    })

    it('should not show autogenerate placeholder for existing record', () => {
      const field = createTextField({ autogeneratePattern: '{random}' })
      const original = createRecord({ id: 'existing' })
      const onChange = vi.fn()

      render(<TextField field={field} original={original} value="test" onChange={onChange} />)

      expect(screen.getByRole('textbox')).not.toHaveAttribute('placeholder', 'Leave empty to autogenerate...')
    })

    it('should not show autogenerate placeholder when no pattern', () => {
      const field = createTextField({ autogeneratePattern: '' })
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      expect(screen.getByRole('textbox')).not.toHaveAttribute('placeholder', 'Leave empty to autogenerate...')
    })
  })

  describe('accessibility', () => {
    it('should have id matching label htmlFor', () => {
      const field = createTextField({ name: 'test_field' })
      const onChange = vi.fn()

      render(<TextField field={field} value="" onChange={onChange} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('id', 'field_test_field')
    })
  })
})
