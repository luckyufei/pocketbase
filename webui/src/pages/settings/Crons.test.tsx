/**
 * Crons Settings 页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Crons } from './Crons'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ crons: [] }),
  })),
}))

describe('Crons Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page elements', () => {
    render(<Crons />)

    // 检查页面标题在 breadcrumb 中
    expect(screen.getByText('Crons')).toBeInTheDocument()
  })

  it('should render refresh button', () => {
    render(<Crons />)

    // 使用 getAllByText 因为按钮文本可能有多个匹配
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
