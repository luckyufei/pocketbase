/**
 * OverlayPanel 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverlayPanel } from './OverlayPanel'

describe('OverlayPanel', () => {
  it('should not render when closed', () => {
    render(
      <OverlayPanel open={false} onClose={vi.fn()}>
        <div>Content</div>
      </OverlayPanel>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <OverlayPanel open={true} onClose={vi.fn()}>
        <div>Content</div>
      </OverlayPanel>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should render title when provided', () => {
    render(
      <OverlayPanel open={true} onClose={vi.fn()} title="Test Title">
        <div>Content</div>
      </OverlayPanel>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <OverlayPanel open={true} onClose={onClose} title="Test">
        <div>Content</div>
      </OverlayPanel>
    )
    fireEvent.click(screen.getByRole('button', { name: /关闭/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('should call onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(
      <OverlayPanel open={true} onClose={onClose}>
        <div>Content</div>
      </OverlayPanel>
    )
    // 点击遮罩层（dialog 本身）
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should call onClose when Escape pressed', () => {
    const onClose = vi.fn()
    render(
      <OverlayPanel open={true} onClose={onClose}>
        <div>Content</div>
      </OverlayPanel>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('should apply width class', () => {
    const { container } = render(
      <OverlayPanel open={true} onClose={vi.fn()} width="xl">
        <div>Content</div>
      </OverlayPanel>
    )
    // 查找面板元素
    const panel = container.querySelector('.w-\\[640px\\]')
    expect(panel).toBeInTheDocument()
  })

  it('should apply position class', () => {
    const { container } = render(
      <OverlayPanel open={true} onClose={vi.fn()} position="left">
        <div>Content</div>
      </OverlayPanel>
    )
    const panel = container.querySelector('.left-0')
    expect(panel).toBeInTheDocument()
  })
})
