/**
 * Tokens Settings 页面测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tokens } from './Tokens'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ tokens: [] }),
  })),
}))

describe('Tokens Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page elements', () => {
    render(<Tokens />)

    expect(screen.getByText('Tokens')).toBeInTheDocument()
  })

  it('should render action buttons', () => {
    render(<Tokens />)

    // 检查有按钮存在
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
