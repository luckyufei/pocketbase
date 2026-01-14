/**
 * GeoPointField 组件测试
 *
 * 测试地理坐标输入字段
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeoPointField } from './GeoPointField'

// Mock Leaflet 地图组件
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: any) => (
    <div data-testid="map-marker" data-lat={position[0]} data-lng={position[1]} />
  ),
  useMapEvents: () => null,
  useMap: () => ({
    panTo: vi.fn(),
    setView: vi.fn(),
  }),
}))

describe('GeoPointField', () => {
  const mockField = {
    id: 'field1',
    name: 'location',
    type: 'geoPoint',
    required: true,
  }

  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染经纬度输入框', () => {
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument()
    })

    it('应该显示字段标签', () => {
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      expect(screen.getByText('location')).toBeInTheDocument()
    })

    it('应该显示必填标记', () => {
      render(
        <GeoPointField
          field={{ ...mockField, required: true }}
          value={{ lat: 0, lon: 0 }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })
  })

  describe('值处理', () => {
    it('应该显示初始坐标值', () => {
      render(
        <GeoPointField
          field={mockField}
          value={{ lat: 40.7128, lon: -74.006 }}
          onChange={mockOnChange}
        />
      )

      const latInput = screen.getByLabelText(/latitude/i)
      const lonInput = screen.getByLabelText(/longitude/i)

      expect(latInput).toHaveValue(40.7128)
      expect(lonInput).toHaveValue(-74.006)
    })

    it('修改经度应该调用 onChange', async () => {
      const user = userEvent.setup()
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      const lonInput = screen.getByLabelText(/longitude/i)
      await user.clear(lonInput)
      await user.type(lonInput, '100')

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('修改纬度应该调用 onChange', async () => {
      const user = userEvent.setup()
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      const latInput = screen.getByLabelText(/latitude/i)
      await user.clear(latInput)
      await user.type(latInput, '50')

      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('坐标范围验证', () => {
    it('纬度应该限制在 -90 到 90', () => {
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      const latInput = screen.getByLabelText(/latitude/i)
      expect(latInput).toHaveAttribute('min', '-90')
      expect(latInput).toHaveAttribute('max', '90')
    })

    it('经度应该限制在 -180 到 180', () => {
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      const lonInput = screen.getByLabelText(/longitude/i)
      expect(lonInput).toHaveAttribute('min', '-180')
      expect(lonInput).toHaveAttribute('max', '180')
    })
  })

  describe('地图切换', () => {
    it('应该有切换地图按钮', () => {
      render(<GeoPointField field={mockField} value={{ lat: 0, lon: 0 }} onChange={mockOnChange} />)

      const toggleButton = screen.getByRole('button', { name: /map/i })
      expect(toggleButton).toBeInTheDocument()
    })

    it('点击切换按钮应该显示地图', async () => {
      const user = userEvent.setup()
      render(
        <GeoPointField
          field={mockField}
          value={{ lat: 40.7128, lon: -74.006 }}
          onChange={mockOnChange}
        />
      )

      const toggleButton = screen.getByRole('button', { name: /map/i })
      await user.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument()
      })
    })
  })

  describe('禁用状态', () => {
    it('禁用时输入框不可编辑', () => {
      render(
        <GeoPointField
          field={mockField}
          value={{ lat: 0, lon: 0 }}
          onChange={mockOnChange}
          disabled
        />
      )

      const latInput = screen.getByLabelText(/latitude/i)
      const lonInput = screen.getByLabelText(/longitude/i)

      expect(latInput).toBeDisabled()
      expect(lonInput).toBeDisabled()
    })
  })

  describe('空值处理', () => {
    it('undefined 值应该默认为 0,0', () => {
      render(<GeoPointField field={mockField} value={undefined as any} onChange={mockOnChange} />)

      const latInput = screen.getByLabelText(/latitude/i)
      const lonInput = screen.getByLabelText(/longitude/i)

      expect(latInput).toHaveValue(0)
      expect(lonInput).toHaveValue(0)
    })
  })
})
