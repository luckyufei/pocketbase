/**
 * FieldLabel 组件测试
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'jotai'
import { FieldLabel } from './FieldLabel'

describe('FieldLabel', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(<Provider>{component}</Provider>)
  }

  describe('字段类型图标', () => {
    it('应该显示 text 类型图标 (ri-text)', () => {
      const field = { name: 'title', type: 'text' as const }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      const icon = screen.getByRole('img', { name: 'text' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 number 类型图标 (ri-hashtag)', () => {
      const field = { name: 'count', type: 'number' as const }

      renderWithProviders(<FieldLabel uniqueId="field_count" field={field} />)

      const icon = screen.getByRole('img', { name: 'hashtag' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 bool 类型图标 (ri-toggle-line)', () => {
      const field = { name: 'active', type: 'bool' as const }

      renderWithProviders(<FieldLabel uniqueId="field_active" field={field} />)

      const icon = screen.getByRole('img', { name: 'toggle-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 email 类型图标 (ri-mail-line)', () => {
      const field = { name: 'email', type: 'email' as const }

      renderWithProviders(<FieldLabel uniqueId="field_email" field={field} />)

      const icon = screen.getByRole('img', { name: 'mail-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 url 类型图标 (ri-link)', () => {
      const field = { name: 'website', type: 'url' as const }

      renderWithProviders(<FieldLabel uniqueId="field_website" field={field} />)

      const icon = screen.getByRole('img', { name: 'link' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 editor 类型图标 (ri-edit-2-line)', () => {
      const field = { name: 'content', type: 'editor' as const }

      renderWithProviders(<FieldLabel uniqueId="field_content" field={field} />)

      const icon = screen.getByRole('img', { name: 'edit-2-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 date 类型图标 (ri-calendar-line)', () => {
      const field = { name: 'created', type: 'date' as const }

      renderWithProviders(<FieldLabel uniqueId="field_created" field={field} />)

      const icon = screen.getByRole('img', { name: 'calendar-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 select 类型图标 (ri-list-check)', () => {
      const field = { name: 'status', type: 'select' as const }

      renderWithProviders(<FieldLabel uniqueId="field_status" field={field} />)

      const icon = screen.getByRole('img', { name: 'list-check' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 json 类型图标 (ri-braces-line)', () => {
      const field = { name: 'metadata', type: 'json' as const }

      renderWithProviders(<FieldLabel uniqueId="field_metadata" field={field} />)

      const icon = screen.getByRole('img', { name: 'braces-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 file 类型图标 (ri-image-line)', () => {
      const field = { name: 'avatar', type: 'file' as const }

      renderWithProviders(<FieldLabel uniqueId="field_avatar" field={field} />)

      const icon = screen.getByRole('img', { name: 'image-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 relation 类型图标 (ri-mind-map)', () => {
      const field = { name: 'author', type: 'relation' as const }

      renderWithProviders(<FieldLabel uniqueId="field_author" field={field} />)

      const icon = screen.getByRole('img', { name: 'mind-map' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 password 类型图标 (ri-lock-password-line)', () => {
      const field = { name: 'password', type: 'password' as const }

      renderWithProviders(<FieldLabel uniqueId="field_password" field={field} />)

      const icon = screen.getByRole('img', { name: 'lock-password-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 geoPoint 类型图标 (ri-map-pin-2-line)', () => {
      const field = { name: 'location', type: 'geoPoint' as const }

      renderWithProviders(<FieldLabel uniqueId="field_location" field={field} />)

      const icon = screen.getByRole('img', { name: 'map-pin-2-line' })
      expect(icon).toBeInTheDocument()
    })

    it('应该显示 secret 类型图标 (ri-shield-keyhole-line)', () => {
      const field = { name: 'apiKey', type: 'secret' as const }

      renderWithProviders(<FieldLabel uniqueId="field_apiKey" field={field} />)

      const icon = screen.getByRole('img', { name: 'shield-keyhole-line' })
      expect(icon).toBeInTheDocument()
    })
  })

  describe('字段名称', () => {
    it('应该显示字段名称', () => {
      const field = { name: 'title', type: 'text' as const }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      expect(screen.getByText('title')).toBeInTheDocument()
    })

    it('超长字段名应该显示在 title 属性中', () => {
      const field = {
        name: 'this_is_a_very_long_field_name_that_exceeds_normal_limits',
        type: 'text' as const,
      }

      renderWithProviders(<FieldLabel uniqueId="field_long" field={field} />)

      const label = screen.getByText(/this_is_a_very_long_field_name/i)
      expect(label).toBeInTheDocument()
    })
  })

  describe('Hidden 字段标签', () => {
    it('field.hidden=true 时应该显示红色 Hidden 标签', () => {
      const field = { name: 'secret', type: 'text' as const, hidden: true }

      renderWithProviders(<FieldLabel uniqueId="field_secret" field={field} />)

      const hiddenLabel = screen.getByText('Hidden')
      expect(hiddenLabel).toBeInTheDocument()
      expect(hiddenLabel).toHaveClass('label-sm')
      expect(hiddenLabel).toHaveClass('label-danger')
    })

    it('field.hidden=false 时不应该显示 Hidden 标签', () => {
      const field = { name: 'title', type: 'text' as const, hidden: false }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    })

    it('field.hidden 未定义时不应该显示 Hidden 标签', () => {
      const field = { name: 'title', type: 'text' as const }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
    })
  })

  describe('children 内容', () => {
    it('应该渲染 children 内容', () => {
      const field = { name: 'title', type: 'text' as const }
      const childContent = <span className="custom-content">Custom</span>

      renderWithProviders(
        <FieldLabel uniqueId="field_title" field={field}>
          {childContent}
        </FieldLabel>
      )

      expect(screen.getByText('Custom')).toBeInTheDocument()
      expect(screen.getByText('Custom')).toHaveClass('custom-content')
    })
  })

  describe('Accessibility', () => {
    it('label 应该有正确的 for 属性', () => {
      const field = { name: 'title', type: 'text' as const }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      const label = screen.getByLabelText('title')
      expect(label).toHaveAttribute('for', 'field_title')
    })

    it('图标应该有正确的 aria-hidden 属性', () => {
      const field = { name: 'title', type: 'text' as const }

      renderWithProviders(<FieldLabel uniqueId="field_title" field={field} />)

      const icon = screen.getByRole('img', { name: 'text' })
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    })
  })
})
