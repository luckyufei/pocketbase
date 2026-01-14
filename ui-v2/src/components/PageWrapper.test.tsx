/**
 * PageWrapper 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'jotai'
import { PageWrapper } from './PageWrapper'

describe('PageWrapper', () => {
  const originalTitle = document.title

  beforeEach(() => {
    document.title = 'Test'
  })

  afterEach(() => {
    document.title = originalTitle
  })

  it('should render children', () => {
    render(
      <Provider>
        <PageWrapper>
          <div>Test Content</div>
        </PageWrapper>
      </Provider>
    )
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render title when provided', () => {
    render(
      <Provider>
        <PageWrapper title="Test Page">
          <div>Content</div>
        </PageWrapper>
      </Provider>
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Page')
  })

  it('should set document title', async () => {
    render(
      <Provider>
        <PageWrapper title="My Page">
          <div>Content</div>
        </PageWrapper>
      </Provider>
    )
    await waitFor(() => {
      expect(document.title).toBe('My Page - PocketBase')
    })
  })

  it('should not render header when no title', () => {
    render(
      <Provider>
        <PageWrapper>
          <div>Content</div>
        </PageWrapper>
      </Provider>
    )
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <Provider>
        <PageWrapper className="custom-class">
          <div>Content</div>
        </PageWrapper>
      </Provider>
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
