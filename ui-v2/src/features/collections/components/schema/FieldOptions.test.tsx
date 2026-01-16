// TDD: 字段选项组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TextFieldOptions } from './TextFieldOptions'
import { NumberFieldOptions } from './NumberFieldOptions'
import { BoolFieldOptions } from './BoolFieldOptions'
import { EmailFieldOptions } from './EmailFieldOptions'
import { UrlFieldOptions } from './UrlFieldOptions'
import { EditorFieldOptions } from './EditorFieldOptions'
import { DateFieldOptions } from './DateFieldOptions'
import { SelectFieldOptions } from './SelectFieldOptions'
import { JsonFieldOptions } from './JsonFieldOptions'
import { FileFieldOptions } from './FileFieldOptions'
import { RelationFieldOptions } from './RelationFieldOptions'
import { PasswordFieldOptions } from './PasswordFieldOptions'
import { AutodateFieldOptions } from './AutodateFieldOptions'
import { GeoPointFieldOptions } from './GeoPointFieldOptions'

describe('TextFieldOptions', () => {
  const mockField = {
    name: 'title',
    type: 'text',
    min: 0,
    max: 100,
    pattern: '',
    autogeneratePattern: '',
  }
  const mockOnChange = vi.fn()

  it('应该渲染 Min length 和 Max length 输入框', () => {
    render(<TextFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/min length/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max length/i)).toBeInTheDocument()
  })

  it('应该渲染 Pattern 和 Autogenerate pattern 输入框', () => {
    render(<TextFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/validation pattern/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/autogenerate pattern/i)).toBeInTheDocument()
  })

  it('修改 min 值应该触发 onChange', async () => {
    const user = userEvent.setup()
    render(<TextFieldOptions field={mockField} onChange={mockOnChange} />)

    const minInput = screen.getByLabelText(/min length/i)
    await user.clear(minInput)
    await user.type(minInput, '10')

    expect(mockOnChange).toHaveBeenCalled()
  })
})

describe('NumberFieldOptions', () => {
  const mockField = { name: 'count', type: 'number', min: 0, max: 100, onlyInt: false }
  const mockOnChange = vi.fn()

  it('应该渲染 Min 和 Max 输入框', () => {
    render(<NumberFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/^min$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^max$/i)).toBeInTheDocument()
  })

  it('应该渲染 No decimals 复选框', () => {
    render(<NumberFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/no decimals/i)).toBeInTheDocument()
  })
})

describe('BoolFieldOptions', () => {
  const mockField = { name: 'active', type: 'bool' }
  const mockOnChange = vi.fn()

  it('应该渲染空的选项（bool 类型没有额外选项）', () => {
    const { container } = render(<BoolFieldOptions field={mockField} onChange={mockOnChange} />)
    // Bool 字段没有额外选项，应该渲染空或提示
    expect(container).toBeInTheDocument()
  })
})

describe('EmailFieldOptions', () => {
  const mockField = { name: 'email', type: 'email', exceptDomains: [], onlyDomains: [] }
  const mockOnChange = vi.fn()

  it('应该渲染 Only domains 和 Except domains 选项', () => {
    render(<EmailFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/only domains/i)).toBeInTheDocument()
    expect(screen.getByText(/except domains/i)).toBeInTheDocument()
  })
})

describe('UrlFieldOptions', () => {
  const mockField = { name: 'website', type: 'url', exceptDomains: [], onlyDomains: [] }
  const mockOnChange = vi.fn()

  it('应该渲染 Only domains 和 Except domains 选项', () => {
    render(<UrlFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/only domains/i)).toBeInTheDocument()
    expect(screen.getByText(/except domains/i)).toBeInTheDocument()
  })
})

describe('EditorFieldOptions', () => {
  const mockField = { name: 'content', type: 'editor', maxSize: 0, convertUrls: true }
  const mockOnChange = vi.fn()

  it('应该渲染 Max size 输入框', () => {
    render(<EditorFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/max size/i)).toBeInTheDocument()
  })

  it('应该渲染 Convert URLs 复选框', () => {
    render(<EditorFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/convert urls/i)).toBeInTheDocument()
  })
})

describe('DateFieldOptions', () => {
  const mockField = { name: 'created', type: 'date', min: '', max: '' }
  const mockOnChange = vi.fn()

  it('应该渲染 Min date 和 Max date 输入框', () => {
    render(<DateFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/min date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max date/i)).toBeInTheDocument()
  })
})

describe('SelectFieldOptions', () => {
  const mockField = { name: 'status', type: 'select', values: ['active', 'inactive'], maxSelect: 1 }
  const mockOnChange = vi.fn()

  it('应该渲染选项值输入区域', () => {
    render(<SelectFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/add choices/i)).toBeInTheDocument()
  })

  it('应该渲染 Single/Multiple 选择', () => {
    render(<SelectFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })
})

describe('JsonFieldOptions', () => {
  const mockField = { name: 'data', type: 'json', maxSize: 0 }
  const mockOnChange = vi.fn()

  it('应该渲染 Max size 输入框', () => {
    render(<JsonFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/max size/i)).toBeInTheDocument()
  })
})

describe('FileFieldOptions', () => {
  const mockField = {
    name: 'avatar',
    type: 'file',
    maxSelect: 1,
    maxSize: 5242880,
    mimeTypes: [],
    thumbs: [],
    protected: false,
  }
  const mockOnChange = vi.fn()

  it('应该渲染 Single/Multiple 选择', () => {
    render(<FileFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })

  it('应该渲染 Allowed mime types 选项', () => {
    render(<FileFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByText(/allowed mime types/i)).toBeInTheDocument()
  })

  it('应该渲染 Max file size 输入框', () => {
    render(<FileFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/max file size/i)).toBeInTheDocument()
  })

  it('应该渲染 Protected 复选框', () => {
    render(<FileFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/protected/i)).toBeInTheDocument()
  })
})

describe('RelationFieldOptions', () => {
  const mockField = {
    name: 'author',
    type: 'relation',
    collectionId: '',
    maxSelect: 1,
    minSelect: 0,
    cascadeDelete: false,
  }
  const mockOnChange = vi.fn()
  const mockCollections = [
    { id: 'c1', name: 'users', type: 'auth' },
    { id: 'c2', name: 'posts', type: 'base' },
  ]

  it('应该渲染 Collection 选择器', () => {
    render(
      <RelationFieldOptions
        field={mockField}
        onChange={mockOnChange}
        collections={mockCollections}
      />
    )
    // 使用 getAllByText 因为 label 和 placeholder 都包含这个文本
    expect(screen.getAllByText(/select collection/i).length).toBeGreaterThan(0)
  })

  it('应该渲染 Single/Multiple 选择', () => {
    render(
      <RelationFieldOptions
        field={mockField}
        onChange={mockOnChange}
        collections={mockCollections}
      />
    )
    expect(screen.getByText(/single/i)).toBeInTheDocument()
  })

  it('应该渲染 Cascade delete 选项', () => {
    render(
      <RelationFieldOptions
        field={mockField}
        onChange={mockOnChange}
        collections={mockCollections}
      />
    )
    expect(screen.getByText(/cascade delete/i)).toBeInTheDocument()
  })
})

describe('PasswordFieldOptions', () => {
  const mockField = { name: 'password', type: 'password', min: 8, max: 72, pattern: '' }
  const mockOnChange = vi.fn()

  it('应该渲染 Min length 和 Max length 输入框', () => {
    render(<PasswordFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/min length/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max length/i)).toBeInTheDocument()
  })
})

describe('AutodateFieldOptions', () => {
  const mockField = { name: 'created', type: 'autodate', onCreate: true, onUpdate: false }
  const mockOnChange = vi.fn()

  it('应该渲染 onCreate 和 onUpdate 复选框', () => {
    render(<AutodateFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(screen.getByLabelText(/on create/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/on update/i)).toBeInTheDocument()
  })
})

describe('GeoPointFieldOptions', () => {
  const mockField = { name: 'location', type: 'geoPoint' }
  const mockOnChange = vi.fn()

  it('应该渲染空的选项（geoPoint 类型没有额外选项）', () => {
    const { container } = render(<GeoPointFieldOptions field={mockField} onChange={mockOnChange} />)
    expect(container).toBeInTheDocument()
  })
})
