/**
 * ProtectedRoute 组件测试
 * TDD: 红灯阶段
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider, createStore } from 'jotai'
import { ProtectedRoute } from './ProtectedRoute'
import { superuserAtom } from '@/store/auth'

describe('ProtectedRoute', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  const renderWithRouter = (initialPath: string = '/protected') => {
    return render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    )
  }

  it('未认证时应该重定向到登录页', () => {
    renderWithRouter()
    expect(screen.getByText('Login Page')).toBeDefined()
  })

  it('已认证时应该显示受保护的内容', () => {
    // 设置用户
    store.set(superuserAtom, {
      id: '123',
      email: 'admin@example.com',
      created: '2024-01-01',
      updated: '2024-01-01',
    })

    renderWithRouter()
    expect(screen.getByText('Protected Content')).toBeDefined()
  })
})
