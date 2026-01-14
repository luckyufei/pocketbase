/**
 * Records UpsertPanel 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpsertPanel } from './UpsertPanel'
import type { RecordModel, SchemaField } from 'pocketbase'

// Mock OverlayPanel
vi.mock('@/components/OverlayPanel', () => ({
  OverlayPanel: ({ open, onClose, title, children }: any) =>
    open ? (
      <div data-testid="overlay-panel">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}))

const createMockRecord = (overrides: Partial<RecordModel> = {}): RecordModel =>
  ({
    id: 'record-123',
    collectionId: 'collection-1',
    collectionName: 'test',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }) as RecordModel

const createMockField = (overrides: Partial<SchemaField> = {}): SchemaField =>
  ({
    id: 'field-1',
    name: 'title',
    type: 'text',
    system: false,
    required: false,
    options: {},
    ...overrides,
  }) as SchemaField

describe('Records UpsertPanel', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(<UpsertPanel open={false} onClose={mockOnClose} fields={[]} onSave={mockOnSave} />)

    expect(screen.queryByTestId('overlay-panel')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={[]} onSave={mockOnSave} />)

    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument()
  })

  it('should show create title when no record', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={[]} onSave={mockOnSave} />)

    expect(screen.getByText('新建记录')).toBeInTheDocument()
  })

  it('should show edit title when record provided', () => {
    const record = createMockRecord()
    render(
      <UpsertPanel
        open={true}
        onClose={mockOnClose}
        record={record}
        fields={[]}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('编辑记录')).toBeInTheDocument()
  })

  it('should render text field', () => {
    const fields = [createMockField({ name: 'title', type: 'text' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    expect(screen.getByLabelText('title')).toBeInTheDocument()
  })

  it('should render number field', () => {
    const fields = [createMockField({ name: 'count', type: 'number' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    const input = screen.getByLabelText('count')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('should render bool field as checkbox', () => {
    const fields = [createMockField({ name: 'active', type: 'bool' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('should render email field', () => {
    const fields = [createMockField({ name: 'email', type: 'email' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    const input = screen.getByLabelText('email')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('should render url field', () => {
    const fields = [createMockField({ name: 'website', type: 'url' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    const input = screen.getByLabelText('website')
    expect(input).toHaveAttribute('type', 'url')
  })

  it('should call onClose when cancel clicked', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={[]} onSave={mockOnSave} />)

    fireEvent.click(screen.getByText('取消'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onSave when form submitted', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const fields = [createMockField({ name: 'title' })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    const input = screen.getByLabelText('title')
    fireEvent.change(input, { target: { value: 'Test Title' } })

    const submitButton = screen.getByText('创建')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })
  })

  it('should show required indicator for required fields', () => {
    const fields = [createMockField({ name: 'title', required: true })]
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={fields} onSave={mockOnSave} />)

    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should show save button for edit mode', () => {
    const record = createMockRecord()
    render(
      <UpsertPanel
        open={true}
        onClose={mockOnClose}
        record={record}
        fields={[]}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('should show create button for create mode', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} fields={[]} onSave={mockOnSave} />)

    expect(screen.getByText('创建')).toBeInTheDocument()
  })
})
