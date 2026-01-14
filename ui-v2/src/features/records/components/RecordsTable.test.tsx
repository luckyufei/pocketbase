/**
 * RecordsTable 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordsTable } from './RecordsTable'
import type { RecordModel, SchemaField } from 'pocketbase'

const createMockRecord = (overrides: Partial<RecordModel> = {}): RecordModel =>
  ({
    id: 'record-123456789',
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

describe('RecordsTable', () => {
  const mockOnSort = vi.fn()
  const mockOnSelect = vi.fn()
  const mockOnSelectAll = vi.fn()
  const mockOnRowClick = vi.fn()

  const defaultProps = {
    records: [],
    fields: [],
    selectedIds: new Set<string>(),
    isAllSelected: false,
    sortState: null,
    onSort: mockOnSort,
    onSelect: mockOnSelect,
    onSelectAll: mockOnSelectAll,
    onRowClick: mockOnRowClick,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render empty state when no records', () => {
    render(<RecordsTable {...defaultProps} />)

    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('should render table headers', () => {
    const fields = [createMockField({ name: 'title' })]
    render(<RecordsTable {...defaultProps} fields={fields} />)

    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('创建时间')).toBeInTheDocument()
  })

  it('should render records', () => {
    const records = [createMockRecord({ id: 'record-123456789', title: 'Test Title' })]
    const fields = [createMockField({ name: 'title' })]
    render(<RecordsTable {...defaultProps} records={records} fields={fields} />)

    expect(screen.getByText('record-1...')).toBeInTheDocument()
  })

  it('should call onSort when header clicked', () => {
    const fields = [createMockField({ name: 'title' })]
    render(<RecordsTable {...defaultProps} fields={fields} />)

    fireEvent.click(screen.getByText('ID'))

    expect(mockOnSort).toHaveBeenCalledWith('id')
  })

  it('should call onRowClick when row clicked', () => {
    const records = [createMockRecord()]
    const fields = [createMockField()]
    render(<RecordsTable {...defaultProps} records={records} fields={fields} />)

    // 点击行
    const row = screen.getByText('record-1...').closest('tr')
    if (row) fireEvent.click(row)

    expect(mockOnRowClick).toHaveBeenCalledWith(records[0])
  })

  it('should show checkbox for each row', () => {
    const records = [createMockRecord()]
    const fields = [createMockField()]
    render(<RecordsTable {...defaultProps} records={records} fields={fields} />)

    const checkboxes = screen.getAllByRole('checkbox')
    // 1 个全选 + 1 个行选择
    expect(checkboxes.length).toBe(2)
  })

  it('should call onSelectAll when header checkbox clicked', () => {
    const fields = [createMockField()]
    render(<RecordsTable {...defaultProps} fields={fields} />)

    const selectAllCheckbox = screen.getByLabelText('全选')
    fireEvent.click(selectAllCheckbox)

    expect(mockOnSelectAll).toHaveBeenCalled()
  })

  it('should show selected state for selected rows', () => {
    const records = [createMockRecord({ id: 'selected-id' })]
    const fields = [createMockField()]
    const selectedIds = new Set(['selected-id'])

    const { container } = render(
      <RecordsTable {...defaultProps} records={records} fields={fields} selectedIds={selectedIds} />
    )

    const row = container.querySelector('tbody tr')
    expect(row).toHaveClass('bg-muted/50')
  })

  it('should render bool field correctly', () => {
    const records = [createMockRecord({ active: true })]
    const fields = [createMockField({ name: 'active', type: 'bool' })]
    render(<RecordsTable {...defaultProps} records={records} fields={fields} />)

    expect(screen.getByText('是')).toBeInTheDocument()
  })

  it('should render null value as dash', () => {
    const records = [createMockRecord({ title: null })]
    const fields = [createMockField({ name: 'title' })]
    render(<RecordsTable {...defaultProps} records={records} fields={fields} />)

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('should limit displayed fields to 5', () => {
    const fields = Array.from({ length: 10 }, (_, i) =>
      createMockField({ name: `field${i}`, id: `field-${i}` })
    )
    render(<RecordsTable {...defaultProps} fields={fields} />)

    // 应该只显示前 5 个字段
    expect(screen.getByText('field0')).toBeInTheDocument()
    expect(screen.getByText('field4')).toBeInTheDocument()
    expect(screen.queryByText('field5')).not.toBeInTheDocument()
  })
})
