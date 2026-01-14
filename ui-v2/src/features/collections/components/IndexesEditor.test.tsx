/**
 * IndexesEditor 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { IndexesEditor } from './IndexesEditor'

describe('IndexesEditor', () => {
  const mockIndexes = [
    'CREATE INDEX idx_title ON collection (title)',
    'CREATE UNIQUE INDEX idx_email ON collection (email)',
  ]

  it('should render list of indexes', () => {
    render(<IndexesEditor indexes={mockIndexes} onChange={() => {}} />)

    expect(screen.getByText(/idx_title/)).toBeInTheDocument()
    expect(screen.getByText(/idx_email/)).toBeInTheDocument()
  })

  it('should show add index button', () => {
    render(<IndexesEditor indexes={[]} onChange={() => {}} />)

    expect(screen.getByText(/add index/i)).toBeInTheDocument()
  })

  it('should call onChange when index is added', () => {
    const handleChange = vi.fn()
    render(<IndexesEditor indexes={[]} onChange={handleChange} />)

    const addBtn = screen.getByText(/add index/i)
    fireEvent.click(addBtn)

    expect(handleChange).toHaveBeenCalled()
  })

  it('should call onChange when index is removed', () => {
    const handleChange = vi.fn()
    render(<IndexesEditor indexes={mockIndexes} onChange={handleChange} />)

    const removeBtn = screen.getAllByRole('button', { name: /remove/i })[0]
    fireEvent.click(removeBtn)

    expect(handleChange).toHaveBeenCalled()
  })
})
