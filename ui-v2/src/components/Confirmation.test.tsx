/**
 * Confirmation 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { confirmationAtom, showConfirmation } from '@/store/confirmation'
import { Confirmation } from './Confirmation'

describe('Confirmation', () => {
  const createTestStore = (
    confirmation: ReturnType<typeof showConfirmation> extends (store: any) => infer R ? R : never
  ) => {
    const store = createStore()
    if (confirmation) {
      store.set(confirmationAtom, confirmation)
    }
    return store
  }

  it('should not render when no confirmation', () => {
    const store = createTestStore(null)
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('should render confirmation dialog', () => {
    const store = createTestStore({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      onConfirm: vi.fn(),
    })
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    const store = createTestStore({
      title: 'Confirm',
      message: 'Please confirm',
      onConfirm,
    })
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    fireEvent.click(screen.getByRole('button', { name: /确定/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('should call onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    const store = createTestStore({
      title: 'Confirm',
      message: 'Please confirm',
      onConfirm: vi.fn(),
      onCancel,
    })
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    fireEvent.click(screen.getByRole('button', { name: /取消/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('should use custom button text', () => {
    const store = createTestStore({
      title: 'Delete',
      message: 'Delete this?',
      onConfirm: vi.fn(),
      confirmText: 'Yes, Delete',
      cancelText: 'No, Keep',
    })
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, Keep' })).toBeInTheDocument()
  })

  it('should apply destructive variant when isDanger is true', () => {
    const store = createTestStore({
      title: 'Delete',
      message: 'Delete this?',
      onConfirm: vi.fn(),
      isDanger: true,
    })
    render(
      <Provider store={store}>
        <Confirmation />
      </Provider>
    )
    const confirmButton = screen.getByRole('button', { name: /确定/i })
    expect(confirmButton).toHaveClass('bg-destructive')
  })
})
