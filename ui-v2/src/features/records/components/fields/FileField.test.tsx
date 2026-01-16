/**
 * FileField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileField } from './FileField'

// Mock RecordFileThumb
vi.mock('../RecordFileThumb', () => ({
  RecordFileThumb: ({ filename }: { filename: string }) => (
    <div data-testid="file-thumb">{filename}</div>
  ),
  getFileType: (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image'
    return 'file'
  },
}))

describe('FileField', () => {
  const mockField = {
    name: 'avatar',
    type: 'file',
    required: false,
    options: {
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: ['image/*'],
    },
  }

  it('should render file input with label', () => {
    render(<FileField field={mockField} value={[]} onChange={() => {}} />)

    expect(screen.getByText('avatar')).toBeInTheDocument()
  })

  it('should show upload button', () => {
    render(<FileField field={mockField} value={[]} onChange={() => {}} />)

    // 组件有 "Choose files" 按钮
    expect(screen.getByText(/choose files/i)).toBeInTheDocument()
  })

  it('should display existing files', () => {
    render(<FileField field={mockField} value={['image.png']} onChange={() => {}} />)

    // 文件名显示在 span 中
    expect(screen.getAllByText('image.png').length).toBeGreaterThan(0)
  })

  it('should call onChange when file is removed', () => {
    const handleChange = vi.fn()
    render(<FileField field={mockField} value={['image.png']} onChange={handleChange} />)

    const removeBtn = screen.getByRole('button', { name: /remove/i })
    fireEvent.click(removeBtn)

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show drag and drop area', () => {
    render(<FileField field={mockField} value={[]} onChange={() => {}} />)

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
  })

  it('should hide upload area when max files reached', () => {
    render(<FileField field={mockField} value={['image.png']} onChange={() => {}} />)

    // maxSelect=1 且已有 1 个文件，不应显示上传区域
    expect(screen.queryByText(/drag and drop/i)).not.toBeInTheDocument()
  })
})
