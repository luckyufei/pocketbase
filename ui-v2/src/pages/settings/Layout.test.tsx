/**
 * Settings Layout 测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SettingsLayout } from './Layout'

describe('Settings Layout', () => {
  const renderLayout = (initialPath = '/settings') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsLayout />}>
            <Route index element={<div>Settings Content</div>} />
            <Route path="application" element={<div>Application Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  it('should render settings sidebar', () => {
    renderLayout()
    // 侧边栏标题
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('should render navigation links', () => {
    renderLayout()
    // 检查导航链接存在
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(5) // 至少有 5 个导航链接
  })

  it('should render outlet content', () => {
    renderLayout('/settings')
    // 验证 main 元素存在 (Layout.tsx 中 main 标签)
    const mainElement = document.querySelector('main')
    expect(mainElement).toBeInTheDocument()
  })
})
