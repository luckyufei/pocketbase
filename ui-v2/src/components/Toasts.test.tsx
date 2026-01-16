/**
 * Toasts 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { toastsAtom, type Toast } from '@/store/toasts'
import { Toasts } from './Toasts'

describe('Toasts', () => {
  const createTestStore = (toasts: Toast[]) => {
    const store = createStore()
    store.set(toastsAtom, toasts)
    return store
  }

  it('should not render when no toasts', () => {
    const store = createTestStore([])
    const { container } = render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render success toast', () => {
    const store = createTestStore([{ id: '1', type: 'success', message: 'Success message' }])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('should render error toast', () => {
    const store = createTestStore([{ id: '1', type: 'error', message: 'Error message' }])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should render warning toast', () => {
    const store = createTestStore([{ id: '1', type: 'warning', message: 'Warning message' }])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByText('Warning message')).toBeInTheDocument()
  })

  it('should render info toast', () => {
    const store = createTestStore([{ id: '1', type: 'info', message: 'Info message' }])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('should render multiple toasts', () => {
    const store = createTestStore([
      { id: '1', type: 'success', message: 'First toast' },
      { id: '2', type: 'error', message: 'Second toast' },
    ])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByText('First toast')).toBeInTheDocument()
    expect(screen.getByText('Second toast')).toBeInTheDocument()
  })

  it('should have close button', () => {
    const store = createTestStore([{ id: '1', type: 'info', message: 'Test message' }])
    render(
      <Provider store={store}>
        <Toasts />
      </Provider>
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
