/**
 * UpsertPanel 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpsertPanel } from './UpsertPanel'
import type { CollectionModel } from 'pocketbase'

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

const createMockCollection = (overrides: Partial<CollectionModel> = {}): CollectionModel =>
  ({
    id: 'test-id',
    name: 'test_collection',
    type: 'base',
    schema: [],
    indexes: [],
    created: '2024-01-01',
    updated: '2024-01-01',
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    options: {},
    ...overrides,
  }) as CollectionModel

describe('UpsertPanel', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(<UpsertPanel open={false} onClose={mockOnClose} onSave={mockOnSave} />)

    expect(screen.queryByTestId('overlay-panel')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument()
  })

  it('should show create title when no collection', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    const titles = screen.getAllByText('新建 Collection')
    expect(titles.length).toBeGreaterThan(0)
  })

  it('should show edit title when collection provided', () => {
    const collection = createMockCollection({ name: 'users' })
    render(
      <UpsertPanel open={true} onClose={mockOnClose} collection={collection} onSave={mockOnSave} />
    )

    const titles = screen.getAllByText('编辑 users')
    expect(titles.length).toBeGreaterThan(0)
  })

  it('should render form fields', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    expect(screen.getByLabelText('名称')).toBeInTheDocument()
    expect(screen.getByText('类型')).toBeInTheDocument()
  })

  it('should render tabs', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    // 基本信息现在在 tabs 上方，不是 tab
    expect(screen.getByText('字段')).toBeInTheDocument()
    expect(screen.getByText('API 规则')).toBeInTheDocument()
    // 选项 tab 只在 auth 类型时显示
  })

  it('should update name input', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    const nameInput = screen.getByLabelText('名称') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'new_collection' } })

    expect(nameInput.value).toBe('new_collection')
  })

  it('should call onClose when cancel clicked', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    fireEvent.click(screen.getByText('取消'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onSave when form submitted', async () => {
    mockOnSave.mockResolvedValue(undefined)
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    const nameInput = screen.getByLabelText('名称')
    fireEvent.change(nameInput, { target: { value: 'test_collection' } })

    const submitButton = screen.getByText('创建')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    })
  })

  it('should show save button for edit mode', () => {
    const collection = createMockCollection()
    render(
      <UpsertPanel open={true} onClose={mockOnClose} collection={collection} onSave={mockOnSave} />
    )

    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('should show create button for create mode', () => {
    render(<UpsertPanel open={true} onClose={mockOnClose} onSave={mockOnSave} />)

    expect(screen.getByText('创建')).toBeInTheDocument()
  })

  it('should populate form with collection data', () => {
    const collection = createMockCollection({ name: 'existing_collection' })
    render(
      <UpsertPanel open={true} onClose={mockOnClose} collection={collection} onSave={mockOnSave} />
    )

    const nameInput = screen.getByLabelText('名称') as HTMLInputElement
    expect(nameInput.value).toBe('existing_collection')
  })
})
