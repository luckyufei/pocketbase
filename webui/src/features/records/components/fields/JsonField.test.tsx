/**
 * JsonField Unit Tests
 * T8400: 创建 JsonField 校验状态图标测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JsonField } from './JsonField'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { CollectionField } from 'pocketbase'

// Mock CodeEditor component
vi.mock('@/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) => (
    <textarea
      id={id}
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

// Helper to create a mock JSON field
function createJsonField(overrides: Partial<CollectionField> = {}): CollectionField {
  return {
    id: 'field_id',
    name: 'metadata',
    type: 'json',
    system: false,
    hidden: false,
    required: false,
    ...overrides,
  } as CollectionField
}

describe('JsonField', () => {
  describe('rendering', () => {
    it('should render with label', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      expect(screen.getByText('metadata')).toBeInTheDocument()
    })

    it('should render code editor', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    })
  })

  describe('JSON validation icon', () => {
    it('should show green icon for valid JSON object', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{ key: 'value' }} onChange={onChange} />
        </TestWrapper>
      )

      // Find the valid (check) icon by its class
      const icon = document.querySelector('.text-green-500')
      expect(icon).toBeInTheDocument()
    })

    it('should show green icon for valid JSON array', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={[1, 2, 3]} onChange={onChange} />
        </TestWrapper>
      )

      const icon = document.querySelector('.text-green-500')
      expect(icon).toBeInTheDocument()
    })

    it('should show green icon for null value', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={null} onChange={onChange} />
        </TestWrapper>
      )

      const icon = document.querySelector('.text-green-500')
      expect(icon).toBeInTheDocument()
    })

    it('should show green icon for primitive values', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={42} onChange={onChange} />
        </TestWrapper>
      )

      const icon = document.querySelector('.text-green-500')
      expect(icon).toBeInTheDocument()
    })

    it('should show green icon for empty string (treated as null)', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value="" onChange={onChange} />
        </TestWrapper>
      )

      // Empty string is treated as null (valid JSON)
      const icon = document.querySelector('.text-green-500')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('value serialization', () => {
    it('should serialize object to pretty JSON', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{ name: 'test' }} onChange={onChange} />
        </TestWrapper>
      )

      const editor = screen.getByTestId('code-editor')
      expect(editor).toHaveValue('{\n  "name": "test"\n}')
    })

    it('should serialize array to pretty JSON', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={[1, 2, 3]} onChange={onChange} />
        </TestWrapper>
      )

      const editor = screen.getByTestId('code-editor')
      expect(editor).toHaveValue('[\n  1,\n  2,\n  3\n]')
    })

    it('should keep valid JSON string as-is', () => {
      const field = createJsonField()
      const onChange = vi.fn()
      const jsonString = '{"already":"formatted"}'

      render(
        <TestWrapper>
          <JsonField field={field} value={jsonString} onChange={onChange} />
        </TestWrapper>
      )

      const editor = screen.getByTestId('code-editor')
      expect(editor).toHaveValue(jsonString)
    })
  })

  describe('onChange handling', () => {
    it('should call onChange with trimmed value', () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      fireEvent.change(screen.getByTestId('code-editor'), {
        target: { value: '  {"test": 1}  ' },
      })

      expect(onChange).toHaveBeenCalledWith('{"test": 1}')
    })

    it('should update validation status on change to invalid', async () => {
      const field = createJsonField()
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      // Initially valid (green icon)
      expect(document.querySelector('.text-green-500')).toBeInTheDocument()

      // Type invalid JSON
      fireEvent.change(screen.getByTestId('code-editor'), {
        target: { value: '{ invalid json' },
      })

      // Should show red icon
      await waitFor(() => {
        expect(document.querySelector('.text-red-500')).toBeInTheDocument()
      })
    })
  })

  describe('required field', () => {
    it('should have required class when field is required', () => {
      const field = createJsonField({ required: true })
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      const container = document.querySelector('.required')
      expect(container).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have id matching label htmlFor', () => {
      const field = createJsonField({ name: 'config' })
      const onChange = vi.fn()

      render(
        <TestWrapper>
          <JsonField field={field} value={{}} onChange={onChange} />
        </TestWrapper>
      )

      const editor = screen.getByTestId('code-editor')
      expect(editor).toHaveAttribute('id', 'field_config')
    })
  })
})
