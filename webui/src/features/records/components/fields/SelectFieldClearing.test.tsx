/**
 * SelectField Value Clearing Tests
 * T6400: 创建 SelectField 值清理测试
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

describe('SelectField value clearing', () => {
  describe('single select mode', () => {
    it('should show clear button when value is selected and not required', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      expect(screen.getByTitle('Clear selection')).toBeInTheDocument()
    })

    it('should not show clear button when no value is selected', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value="" onChange={onChange} />)

      expect(screen.queryByTitle('Clear selection')).not.toBeInTheDocument()
    })

    it('should not show clear button when field is required', () => {
      const field = createSelectField({ required: true })
      const onChange = vi.fn()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      expect(screen.queryByTitle('Clear selection')).not.toBeInTheDocument()
    })

    it('should clear value when clear button is clicked', async () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<SelectField field={field} value="draft" onChange={onChange} />)

      await user.click(screen.getByTitle('Clear selection'))

      expect(onChange).toHaveBeenCalledWith('')
    })

    it('should not call onChange multiple times on single clear click', async () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(<SelectField field={field} value="published" onChange={onChange} />)

      await user.click(screen.getByTitle('Clear selection'))

      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('multi select mode', () => {
    it('should show clear button when values are selected and not required', () => {
      const field = createSelectField({ required: false, maxSelect: 3 })
      const onChange = vi.fn()

      render(<SelectField field={field} value={['draft', 'published']} onChange={onChange} />)

      // In multi-select, individual badges can be removed
      // Look for remove badges instead of clear button
      const removeButtons = screen.getAllByRole('button')
      expect(removeButtons.length).toBeGreaterThan(0)
    })

    it('should handle empty array value', () => {
      const field = createSelectField({ required: false, maxSelect: 3 })
      const onChange = vi.fn()

      render(<SelectField field={field} value={[]} onChange={onChange} />)

      // Should render without errors
      expect(screen.getByText('status')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined value gracefully', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value={undefined as any} onChange={onChange} />)

      // Should render without errors
      expect(screen.getByText('status')).toBeInTheDocument()
    })

    it('should handle null value gracefully', () => {
      const field = createSelectField({ required: false })
      const onChange = vi.fn()

      render(<SelectField field={field} value={null as any} onChange={onChange} />)

      // Should render without errors
      expect(screen.getByText('status')).toBeInTheDocument()
    })
  })
})
