/**
 * CollectionItem 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollectionItem } from './CollectionItem'
import type { CollectionModel } from 'pocketbase'

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

describe('CollectionItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render collection name', () => {
    const collection = createMockCollection({ name: 'users' })
    render(<CollectionItem collection={collection} />)

    expect(screen.getByText('users')).toBeInTheDocument()
  })

  it('should show database icon for base type', () => {
    const collection = createMockCollection({ type: 'base' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-database')
    expect(icon).toBeInTheDocument()
  })

  it('should show users icon for auth type', () => {
    const collection = createMockCollection({ type: 'auth' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-users')
    expect(icon).toBeInTheDocument()
  })

  it('should show eye icon for view type', () => {
    const collection = createMockCollection({ type: 'view' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-eye')
    expect(icon).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    const collection = createMockCollection()
    render(<CollectionItem collection={collection} onClick={onClick} />)

    fireEvent.click(screen.getByText('test_collection'))

    expect(onClick).toHaveBeenCalled()
  })

  it('should have active styles when isActive is true', () => {
    const collection = createMockCollection()
    const { container } = render(<CollectionItem collection={collection} isActive={true} />)

    const item = container.firstChild as HTMLElement
    expect(item).toHaveClass('bg-primary')
  })

  it('should not have active styles when isActive is false', () => {
    const collection = createMockCollection()
    const { container } = render(<CollectionItem collection={collection} isActive={false} />)

    const item = container.firstChild as HTMLElement
    expect(item).not.toHaveClass('bg-primary')
  })

  it('should render dropdown menu trigger', () => {
    const collection = createMockCollection()
    const { container } = render(<CollectionItem collection={collection} />)

    // 检查按钮存在
    const button = container.querySelector('button')
    expect(button).toBeInTheDocument()
  })

  it('should have correct color for base type icon', () => {
    const collection = createMockCollection({ type: 'base' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-database')
    expect(icon).toHaveClass('text-blue-500')
  })

  it('should have correct color for auth type icon', () => {
    const collection = createMockCollection({ type: 'auth' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-users')
    expect(icon).toHaveClass('text-green-500')
  })

  it('should have correct color for view type icon', () => {
    const collection = createMockCollection({ type: 'view' })
    const { container } = render(<CollectionItem collection={collection} />)

    const icon = container.querySelector('.lucide-eye')
    expect(icon).toHaveClass('text-purple-500')
  })
})
