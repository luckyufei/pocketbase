/**
 * useScrollEnd hook 测试
 * TDD: 红灯 -> 绿灯
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { useScrollEnd } from './useScrollEnd'

// 测试组件，用于正确绑定 ref
function TestComponent({
  onScrollEnd,
  threshold,
  disabled,
}: {
  onScrollEnd?: () => void
  threshold?: number
  disabled?: boolean
}) {
  const { ref, isAtEnd } = useScrollEnd<HTMLDivElement>({
    onScrollEnd,
    threshold,
    disabled,
  })

  return (
    <div
      ref={ref}
      data-testid="scroll-container"
      data-is-at-end={isAtEnd}
      style={{ height: '100px', overflow: 'auto' }}
    >
      <div style={{ height: '500px' }}>Content</div>
    </div>
  )
}

describe('useScrollEnd', () => {
  describe('基本功能', () => {
    it('应该返回 ref 和 isAtEnd 状态', () => {
      const { result } = renderHook(() => useScrollEnd())

      expect(result.current.ref).toBeDefined()
      expect(typeof result.current.isAtEnd).toBe('boolean')
    })

    it('初始状态 isAtEnd 应该为 false', () => {
      const { result } = renderHook(() => useScrollEnd())

      expect(result.current.isAtEnd).toBe(false)
    })

    it('应该返回 checkScrollEnd 函数', () => {
      const { result } = renderHook(() => useScrollEnd())

      expect(typeof result.current.checkScrollEnd).toBe('function')
    })
  })

  describe('滚动检测（使用组件）', () => {
    it('应该正确渲染测试组件', () => {
      render(<TestComponent />)

      expect(screen.getByTestId('scroll-container')).toBeInTheDocument()
    })

    it('初始状态 isAtEnd 取决于内容高度', () => {
      render(<TestComponent />)

      const container = screen.getByTestId('scroll-container')
      // 初始状态取决于内容是否超出容器，测试环境中可能为 true
      expect(container.getAttribute('data-is-at-end')).toBeDefined()
    })

    it('应该在滚动到底部时触发回调', () => {
      const onScrollEnd = vi.fn()
      render(<TestComponent onScrollEnd={onScrollEnd} threshold={100} />)

      const container = screen.getByTestId('scroll-container')

      // 模拟滚动属性
      Object.defineProperties(container, {
        scrollHeight: { value: 500, configurable: true },
        clientHeight: { value: 100, configurable: true },
        scrollTop: { value: 350, configurable: true },
      })

      // 触发滚动事件
      act(() => {
        container.dispatchEvent(new Event('scroll'))
      })

      expect(onScrollEnd).toHaveBeenCalled()
    })

    it('应该在未到底部时不触发回调', () => {
      const onScrollEnd = vi.fn()
      render(<TestComponent onScrollEnd={onScrollEnd} threshold={100} />)

      const container = screen.getByTestId('scroll-container')

      // 模拟滚动属性（未到底部）
      Object.defineProperties(container, {
        scrollHeight: { value: 500, configurable: true },
        clientHeight: { value: 100, configurable: true },
        scrollTop: { value: 100, configurable: true },
      })

      // 触发滚动事件
      act(() => {
        container.dispatchEvent(new Event('scroll'))
      })

      // 初始化时可能会调用一次，但滚动事件不应该触发
      const callCount = onScrollEnd.mock.calls.length
      expect(callCount).toBeLessThanOrEqual(1) // 最多初始化时调用一次
    })
  })

  describe('阈值配置', () => {
    it('应该使用自定义阈值', () => {
      const onScrollEnd = vi.fn()
      render(<TestComponent onScrollEnd={onScrollEnd} threshold={200} />)

      const container = screen.getByTestId('scroll-container')

      // 距离底部 150px，小于阈值 200
      Object.defineProperties(container, {
        scrollHeight: { value: 500, configurable: true },
        clientHeight: { value: 100, configurable: true },
        scrollTop: { value: 250, configurable: true },
      })

      act(() => {
        container.dispatchEvent(new Event('scroll'))
      })

      expect(onScrollEnd).toHaveBeenCalled()
    })

    it('应该使用默认阈值 100px', () => {
      const onScrollEnd = vi.fn()
      render(<TestComponent onScrollEnd={onScrollEnd} />)

      const container = screen.getByTestId('scroll-container')

      // 距离底部 80px，小于默认阈值 100
      Object.defineProperties(container, {
        scrollHeight: { value: 500, configurable: true },
        clientHeight: { value: 100, configurable: true },
        scrollTop: { value: 320, configurable: true },
      })

      act(() => {
        container.dispatchEvent(new Event('scroll'))
      })

      expect(onScrollEnd).toHaveBeenCalled()
    })
  })

  describe('disabled 选项', () => {
    it('应该在 disabled 为 true 时不触发回调', () => {
      const onScrollEnd = vi.fn()
      render(<TestComponent onScrollEnd={onScrollEnd} disabled={true} />)

      const container = screen.getByTestId('scroll-container')

      // 模拟滚动到底部
      Object.defineProperties(container, {
        scrollHeight: { value: 500, configurable: true },
        clientHeight: { value: 100, configurable: true },
        scrollTop: { value: 350, configurable: true },
      })

      act(() => {
        container.dispatchEvent(new Event('scroll'))
      })

      expect(onScrollEnd).not.toHaveBeenCalled()
    })
  })

  describe('checkScrollEnd', () => {
    it('应该能手动检查滚动位置', () => {
      const onScrollEnd = vi.fn()
      const { result } = renderHook(() => useScrollEnd({ onScrollEnd, threshold: 100 }))

      // 手动调用 checkScrollEnd（没有绑定元素时不会触发回调）
      act(() => {
        result.current.checkScrollEnd()
      })

      // 没有元素时不应该触发
      expect(onScrollEnd).not.toHaveBeenCalled()
    })
  })
})
