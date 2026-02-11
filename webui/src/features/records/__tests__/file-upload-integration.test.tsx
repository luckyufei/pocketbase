/**
 * UpsertPanel 文件上传集成测试
 * 测试文件上传、删除、拖拽、预览等功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'
import { createMemoryHistory } from '@tanstack/react-router'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { UpsertPanel } from '../components/UpsertPanel'
import { pb } from '@/lib/pocketbase'

// Mock PocketBase
const mockCollectionAPI = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockFilesAPI = {
  getURL: vi.fn((record, filename, options) => {
    const token = options?.token
    const tokenParam = token ? `?token=${token}` : ''
    return `http://example.com/files/${record.collectionId}/${record.id}/${filename}${tokenParam}`
  }),
}

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: vi.fn(() => mockCollectionAPI),
    files: mockFilesAPI,
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock FileReader
const mockFileReader = {
  readAsDataURL: vi.fn((file) => {
    // 模拟异步读取
    setTimeout(() => {
      mockFileReader.onload?.({ target: { result: 'data:image/png;base64,mock-data' } })
    }, 0)
  }),
  onload: null,
}

global.FileReader = vi.fn(() => mockFileReader) as any

describe('UpsertPanel File Upload Integration', () => {
  const mockOnSave = vi.fn()
  const mockOnOpenChange = vi.fn()

  const collectionWithFile = {
    id: 'profiles',
    name: 'profiles',
    type: 'base' as const,
    fields: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text', required: true },
      { name: 'avatar', type: 'file', required: false, maxSelect: 1 },
      { name: 'gallery', type: 'file', required: false, maxSelect: 5 },
    ],
  }

  const existingRecordWithFiles = {
    id: 'profile-1',
    collectionId: 'profiles',
    name: 'John Doe',
    avatar: 'avatar.jpg',
    gallery: ['photo1.jpg', 'photo2.jpg'],
    created: '2024-01-10 10:30:00',
    updated: '2024-01-10 10:30:00',
  }

  const newRecord = {
    id: 'profile-2',
    name: 'New Profile',
    avatar: 'new-avatar.jpg',
    gallery: ['new-photo1.jpg'],
    created: '2024-01-15 10:30:00',
    updated: '2024-01-15 10:30:00',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockOnSave.mockClear()
    mockOnOpenChange.mockClear()

    mockCollectionAPI.create.mockResolvedValue(newRecord)
    mockCollectionAPI.update.mockResolvedValue(existingRecordWithFiles)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    const history = createMemoryHistory({ initialEntries: ['/'] })

    const router = createRouter({
      history,
      routes: [
        {
          path: '/',
          element: component,
        },
      ],
    })

    return render(
      <Provider>
        <RouterProvider router={router} />
      </Provider>
    )
  }

  const createMockFile = (name: string, type = 'image/jpeg') => {
    const file = new File(['mock content'], name, { type })
    Object.defineProperty(file, 'size', { value: 1024 })
    return file
  }

  describe('新建记录时上传文件', () => {
    it('应该上传单个文件并使用 key+ 语法', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 填写必填字段
      await userEvent.type(screen.getByLabelText('name'), 'Test Profile')

      // 上传文件
      const fileInput = screen.getByLabelText(/avatar/i) as HTMLInputElement
      const file = createMockFile('avatar.jpg')
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.create).toHaveBeenCalledTimes(1)
      })

      // 验证 FormData 包含 key+ 语法
      const formData = mockCollectionAPI.create.mock.calls[0][0] as FormData
      expect(formData.get('avatar+')).toBe(file)
    })

    it('应该上传多个文件并使用多个 key+ 语法', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 填写必填字段
      await userEvent.type(screen.getByLabelText('name'), 'Test Profile')

      // 上传多个文件
      const fileInput = screen.getByLabelText(/gallery/i) as HTMLInputElement
      const file1 = createMockFile('photo1.jpg')
      const file2 = createMockFile('photo2.jpg')
      Object.defineProperty(fileInput, 'files', {
        value: [file1, file2],
        writable: false,
      })
      fireEvent.change(fileInput)

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /create/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.create).toHaveBeenCalledTimes(1)
      })

      // 验证 FormData 包含多个 key+ 语法
      const formData = mockCollectionAPI.create.mock.calls[0][0] as FormData
      const entries = Array.from(formData.entries())
      expect(entries.some(([key]) => key === 'gallery+')).toBe(true)
    })

    it('应该显示新上传文件的预览', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 上传文件
      const fileInput = screen.getByLabelText(/avatar/i) as HTMLInputElement
      const file = createMockFile('avatar.jpg')
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      // 应该显示文件预览
      await waitFor(() => {
        const previews = screen.getAllByAltText(/avatar/i)
        expect(previews.length).toBeGreaterThan(0)
      })
    })
  })

  describe('编辑记录时管理文件', () => {
    it('应该显示已上传的文件', () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 应该显示 avatar
      expect(screen.getByAltText(/avatar/i)).toBeInTheDocument()

      // 应该显示 gallery 文件
      expect(screen.getByAltText(/photo1/i)).toBeInTheDocument()
      expect(screen.getByAltText(/photo2/i)).toBeInTheDocument()
    })

    it('删除已上传文件应该使用 key- 语法', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 删除 avatar
      const deleteAvatarButton = screen.getByTitle(/delete avatar/i)
      await userEvent.click(deleteAvatarButton)

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.update).toHaveBeenCalledTimes(1)
      })

      // 验证 FormData 包含 key- 语法
      const formData = mockCollectionAPI.update.mock.calls[0][1] as FormData
      expect(formData.get('avatar-')).toBe('avatar.jpg')
    })

    it('应该同时删除多个文件', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 删除多个文件
      const deleteButton1 = screen.getByTitle(/delete photo1/i)
      const deleteButton2 = screen.getByTitle(/delete photo2/i)
      await userEvent.click(deleteButton1)
      await userEvent.click(deleteButton2)

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.update).toHaveBeenCalledTimes(1)
      })

      // 验证 FormData 包含多个 key- 语法
      const formData = mockCollectionAPI.update.mock.calls[0][1] as FormData
      const entries = Array.from(formData.entries())
      expect(entries.some(([key, value]) => key === 'gallery-' && value === 'photo1.jpg')).toBe(true)
      expect(entries.some(([key, value]) => key === 'gallery-' && value === 'photo2.jpg')).toBe(true)
    })

    it('应该同时添加新文件和删除旧文件', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 删除旧 avatar
      const deleteAvatarButton = screen.getByTitle(/delete avatar/i)
      await userEvent.click(deleteAvatarButton)

      // 上传新 avatar
      const fileInput = screen.getByLabelText(/avatar/i) as HTMLInputElement
      const newFile = createMockFile('new-avatar.jpg')
      Object.defineProperty(fileInput, 'files', {
        value: [newFile],
        writable: false,
      })
      fireEvent.change(fileInput)

      // 提交表单
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.update).toHaveBeenCalledTimes(1)
      })

      // 验证 FormData 包含 key- 和 key+ 语法
      const formData = mockCollectionAPI.update.mock.calls[0][1] as FormData
      expect(formData.get('avatar-')).toBe('avatar.jpg')
      expect(formData.get('avatar+')).toBe(newFile)
    })
  })

  describe('文件拖拽上传', () => {
    it('应该支持拖拽文件到上传区域', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 找到拖拽区域
      const dropZone = screen.getByTestId('file-drop-zone-avatar')

      // 拖拽文件
      const file = createMockFile('dragged.jpg')
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [file],
        },
        writable: false,
      })

      fireEvent(dropZone, dropEvent)

      // 应该显示文件预览
      await waitFor(() => {
        const previews = screen.getAllByAltText(/avatar/i)
        expect(previews.length).toBeGreaterThan(0)
      })
    })

    it('拖拽时应该显示视觉反馈', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 找到拖拽区域
      const dropZone = screen.getByTestId('file-drop-zone-avatar')

      // 触发 dragover 事件
      const dragOverEvent = new Event('dragover', { bubbles: true })
      Object.defineProperty(dragOverEvent, 'dataTransfer', {
        value: {
          effectAllowed: 'copy',
        },
        writable: false,
      })

      fireEvent(dropZone, dragOverEvent)

      // 应该显示拖拽高亮样式
      expect(dropZone).toHaveClass('drag-over')

      // 触发 dragleave 事件
      const dragLeaveEvent = new Event('dragleave', { bubbles: true })
      fireEvent(dropZone, dragLeaveEvent)

      // 应该移除拖拽高亮样式
      expect(dropZone).not.toHaveClass('drag-over')
    })
  })

  describe('文件限制', () => {
    it('超过 maxSelect 时应该禁用上传按钮', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 上传 5 个文件（达到 maxSelect 限制）
      const fileInput = screen.getByLabelText(/gallery/i) as HTMLInputElement
      const files = Array.from({ length: 5 }, (_, i) => createMockFile(`photo${i}.jpg`))
      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        // 上传按钮应该被禁用
        const uploadButton = screen.getByLabelText(/upload more/i)
        expect(uploadButton).toBeDisabled()
      })
    })

    it('应该根据 field.mimeTypes 限制文件类型', async () => {
      const collectionWithMimeTypes = {
        ...collectionWithFile,
        fields: [
          ...collectionWithFile.fields,
          {
            name: 'document',
            type: 'file' as const,
            required: false,
            maxSelect: 1,
            mimeTypes: ['application/pdf', 'application/msword'],
          },
        ],
      }

      renderWithProviders(
        <UpsertPanel
          collection={collectionWithMimeTypes}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      const fileInput = screen.getByLabelText(/document/i) as HTMLInputElement

      // 验证 accept 属性
      expect(fileInput).toHaveAttribute('accept', 'application/pdf,application/msword')
    })
  })

  describe('文件预览和操作', () => {
    it('应该显示已上传文件的缩略图', () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 验证 getURL 被调用
      expect(mockFilesAPI.getURL).toHaveBeenCalledWith(
        existingRecordWithFiles,
        'avatar.jpg',
        expect.any(Object)
      )

      // 验证显示缩略图
      const avatar = screen.getByAltText(/avatar/i) as HTMLImageElement
      expect(avatar.src).toContain('avatar.jpg')
    })

    it('点击文件应该在新标签打开', async () => {
      const originalOpen = window.open
      window.open = vi.fn()

      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 点击文件
      const avatar = screen.getByAltText(/avatar/i)
      await userEvent.click(avatar)

      // 验证在新标签打开
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('avatar.jpg'),
        '_blank'
      )

      window.open = originalOpen
    })

    it('应该支持文件拖拽排序', async () => {
      renderWithProviders(
        <UpsertPanel
          collection={collectionWithFile}
          record={existingRecordWithFiles}
          open={true}
          onOpenChange={mockOnOpenChange}
          onSave={mockOnSave}
        />
      )

      // 找到文件项
      const file1 = screen.getByTestId('file-item-photo1.jpg')
      const file2 = screen.getByTestId('file-item-photo2.jpg')

      // 拖拽 file1 到 file2 位置
      const dragStartEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: { setData: vi.fn() },
        writable: false,
      })
      fireEvent(file1, dragStartEvent)

      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { getData: vi.fn(() => 'photo1.jpg') },
        writable: false,
      })
      fireEvent(file2, dropEvent)

      // 提交表单验证顺序
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockCollectionAPI.update).toHaveBeenCalled()
      })

      // 验证 FormData 中的顺序
      const formData = mockCollectionAPI.update.mock.calls[0][1] as FormData
      const galleryValues = formData.getAll('gallery')
      expect(galleryValues).toEqual(['photo2.jpg', 'photo1.jpg'])
    })
  })
})
