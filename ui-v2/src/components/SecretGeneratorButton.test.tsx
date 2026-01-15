/**
 * SecretGeneratorButton.test.tsx - SecretGeneratorButton 组件测试
 *
 * 注意: DropdownMenu 使用 Radix Portal 渲染内容，在测试环境中行为可能不同
 * 这里主要测试组件渲染和基本属性
 */
import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SecretGeneratorButton } from './SecretGeneratorButton'

describe('SecretGeneratorButton', () => {
  it('should render trigger button', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger).toBeDefined()
  })

  it('should have correct aria-label', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('Generate secret')
  })

  it('should apply custom className', () => {
    render(<SecretGeneratorButton className="custom-class" />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger.className).toContain('custom-class')
  })

  it('should be a button with type button', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger.getAttribute('type')).toBe('button')
  })

  it('should have aria-haspopup menu', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('should initially have data-state closed', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    expect(trigger.getAttribute('data-state')).toBe('closed')
  })

  it('should render without crashing with all props', () => {
    const { container } = render(
      <SecretGeneratorButton
        length={16}
        onGenerate={() => {}}
        className="test-class"
      />
    )
    expect(container.querySelector('button')).toBeDefined()
  })

  it('should render sparkles icon', () => {
    render(<SecretGeneratorButton />)
    const trigger = screen.getByTestId('generator-trigger')
    const svg = trigger.querySelector('svg')
    expect(svg).toBeDefined()
    expect(svg?.classList.contains('lucide-sparkles')).toBe(true)
  })
})
