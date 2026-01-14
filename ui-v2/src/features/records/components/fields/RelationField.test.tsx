/**
 * RelationField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { RelationField } from './RelationField'

describe('RelationField', () => {
  const mockField = {
    name: 'author',
    type: 'relation',
    required: false,
    options: {
      collectionId: 'users',
      maxSelect: 1,
    },
  }

  it('should render relation field with label', () => {
    render(<RelationField field={mockField} value="" onChange={() => {}} />)

    expect(screen.getByText('author')).toBeInTheDocument()
  })

  it('should show select button', () => {
    render(<RelationField field={mockField} value="" onChange={() => {}} />)

    expect(screen.getByText(/select/i)).toBeInTheDocument()
  })

  it('should display selected relation id', () => {
    render(<RelationField field={mockField} value="abc123" onChange={() => {}} />)

    expect(screen.getByText(/abc123/i)).toBeInTheDocument()
  })

  it('should support multiple relations', () => {
    const multiField = {
      ...mockField,
      options: { ...mockField.options, maxSelect: 5 },
    }
    render(<RelationField field={multiField} value={['id1', 'id2']} onChange={() => {}} />)

    expect(screen.getByText(/id1/i)).toBeInTheDocument()
    expect(screen.getByText(/id2/i)).toBeInTheDocument()
  })
})
