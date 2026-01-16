/**
 * EditorField 组件测试
 *
 * 测试富文本编辑器字段
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorField } from './EditorField'

// Mock TinyMCE - 因为 TinyMCE 需要 DOM 环境，我们 mock 它
vi.mock('@tinymce/tinymce-react', () => ({
  Editor: ({ value, onEditorChange, disabled, init }: any) => (
    <div data-testid="tinymce-editor">
      <textarea
        data-testid="tinymce-textarea"
        value={value}
        onChange={(e) => onEditorChange?.(e.target.value)}
        disabled={disabled}
        placeholder="Rich text editor"
      />
      <span data-testid="tinymce-height">{init?.height || 300}</span>
    </div>
  ),
}))

describe('EditorField', () => {
  const mockField = {
    id: 'field1',
    name: 'content',
    type: 'editor',
    required: true,
    options: {
      convertUrls: false,
    },
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染编辑器', () => {
      render(<EditorField field={mockField} value="" onChange={mockOnChange} />)

      expect(screen.getByTestId('tinymce-editor')).toBeInTheDocument()
    })

    it('应该显示字段标签', () => {
      render(<EditorField field={mockField} value="" onChange={mockOnChange} />)

      expect(screen.getByText('content')).toBeInTheDocument()
    })

    it('应该显示必填标记', () => {
      render(
        <EditorField field={{ ...mockField, required: true }} value="" onChange={mockOnChange} />
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })
  })

  describe('值处理', () => {
    it('应该显示初始值', () => {
      render(<EditorField field={mockField} value="<p>Hello World</p>" onChange={mockOnChange} />)

      const textarea = screen.getByTestId('tinymce-textarea')
      expect(textarea).toHaveValue('<p>Hello World</p>')
    })

    it('编辑时应该调用 onChange', async () => {
      const user = userEvent.setup()
      render(<EditorField field={mockField} value="" onChange={mockOnChange} />)

      const textarea = screen.getByTestId('tinymce-textarea')
      await user.type(textarea, '<p>New content</p>')

      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('禁用状态', () => {
    it('禁用时编辑器不可编辑', () => {
      render(<EditorField field={mockField} value="test" onChange={mockOnChange} disabled />)

      const textarea = screen.getByTestId('tinymce-textarea')
      expect(textarea).toBeDisabled()
    })
  })

  describe('配置选项', () => {
    it('应该支持自定义高度', () => {
      render(
        <EditorField
          field={{
            ...mockField,
            options: { height: 500 },
          }}
          value=""
          onChange={mockOnChange}
        />
      )

      // 检查高度配置被传递
      expect(screen.getByTestId('tinymce-height')).toHaveTextContent('500')
    })
  })

  describe('回退模式', () => {
    it('TinyMCE 不可用时应该回退到 textarea', async () => {
      // 使用 useFallback 模式
      render(
        <EditorField
          field={mockField}
          value="<p>Fallback content</p>"
          onChange={mockOnChange}
          useFallback
        />
      )

      // 回退模式应该渲染原生 textarea
      const textarea = screen.getByPlaceholderText('Enter HTML content...')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue('<p>Fallback content</p>')
    })
  })
})
