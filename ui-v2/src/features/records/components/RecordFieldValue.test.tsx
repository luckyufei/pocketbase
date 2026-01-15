/**
 * RecordFieldValue.test.tsx - 记录字段值展示组件测试
 * 主要测试 secret 字段的掩码显示
 */
import { describe, expect, it } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { RecordFieldValue } from './RecordFieldValue'
import type { RecordModel, SchemaField } from 'pocketbase'

describe('RecordFieldValue', () => {
  describe('secret field', () => {
    const secretField: SchemaField = {
      id: 'secret_field',
      name: 'api_key',
      type: 'secret',
      system: false,
      required: false,
    }

    it('should render masked value for secret field', () => {
      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        api_key: 'sk-1234567890abcdef',
      } as RecordModel

      render(<RecordFieldValue record={record} field={secretField} />)

      // Should show masked value (first 3 + middle dots (max 10) + last 3)
      const element = screen.getByText('sk-••••••••••def')
      expect(element).toBeDefined()
      expect(element.className).toContain('text-muted-foreground')
      expect(element.className).toContain('font-mono')
    })

    it('should show N/A for empty secret field', () => {
      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        api_key: '',
      } as RecordModel

      render(<RecordFieldValue record={record} field={secretField} />)

      expect(screen.getByText('N/A')).toBeDefined()
    })

    it('should show N/A for null secret field', () => {
      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        api_key: null,
      } as unknown as RecordModel

      render(<RecordFieldValue record={record} field={secretField} />)

      expect(screen.getByText('N/A')).toBeDefined()
    })

    it('should fully mask short secret values (length <= 8)', () => {
      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        api_key: 'short',
      } as RecordModel

      render(<RecordFieldValue record={record} field={secretField} />)

      // For length <= 8, should be fully masked
      expect(screen.getByText('•••••')).toBeDefined()
    })
  })

  describe('other fields', () => {
    it('should render text field correctly', () => {
      const textField: SchemaField = {
        id: 'text_field',
        name: 'title',
        type: 'text',
        system: false,
        required: false,
      }

      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        title: 'Hello World',
      } as RecordModel

      render(<RecordFieldValue record={record} field={textField} />)

      expect(screen.getByText('Hello World')).toBeDefined()
    })

    it('should render bool field correctly', () => {
      const boolField: SchemaField = {
        id: 'bool_field',
        name: 'active',
        type: 'bool',
        system: false,
        required: false,
      }

      const record = {
        id: 'test-id',
        collectionId: 'col-id',
        collectionName: 'test',
        created: '2024-01-01',
        updated: '2024-01-01',
        active: true,
      } as RecordModel

      render(<RecordFieldValue record={record} field={boolField} />)

      expect(screen.getByText('True')).toBeDefined()
    })
  })
})
