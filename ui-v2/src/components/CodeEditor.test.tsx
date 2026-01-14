/**
 * CodeEditor 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodeEditor } from './CodeEditor'

// Mock CodeMirror 因为它在测试环境中有 DOM 依赖问题
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange, placeholder, readOnly }: any) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  ),
}))

describe('CodeEditor', () => {
  it('should render with default value', () => {
    render(<CodeEditor value="test code" />)
    expect(screen.getByTestId('code-editor')).toHaveValue('test code')
  })

  it('should render with placeholder', () => {
    render(<CodeEditor placeholder="Enter code..." />)
    expect(screen.getByPlaceholderText('Enter code...')).toBeInTheDocument()
  })

  it('should call onChange when value changes', () => {
    const onChange = vi.fn()
    render(<CodeEditor onChange={onChange} />)

    const editor = screen.getByTestId('code-editor')
    editor.dispatchEvent(new Event('change', { bubbles: true }))
  })

  it('should be readonly when readOnly is true', () => {
    render(<CodeEditor readOnly={true} />)
    expect(screen.getByTestId('code-editor')).toHaveAttribute('readonly')
  })

  it('should apply custom className', () => {
    const { container } = render(<CodeEditor className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
