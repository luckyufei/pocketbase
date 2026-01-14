// T015: RouteLoading 测试
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouteLoading } from './RouteLoading'

describe('RouteLoading', () => {
  it('should render loading spinner', () => {
    render(<RouteLoading />)

    // 检查加载文本
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('should have proper styling', () => {
    const { container } = render(<RouteLoading />)

    // 检查容器有正确的 flex 布局
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center')
  })

  it('should render spinning loader icon', () => {
    const { container } = render(<RouteLoading />)

    // 检查有 animate-spin 类
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
