/**
 * DevicesPie 组件测试
 */
import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { DevicesPie } from './DevicesPie'

describe('DevicesPie', () => {
  const mockData = [
    { device: 'Desktop', count: 500, percentage: 50 },
    { device: 'Mobile', count: 400, percentage: 40 },
    { device: 'Tablet', count: 100, percentage: 10 },
  ]

  it('should render pie chart container', () => {
    render(<DevicesPie data={mockData} />)

    expect(screen.getByTestId('devices-pie')).toBeInTheDocument()
  })

  it('should display device labels', () => {
    render(<DevicesPie data={mockData} />)

    expect(screen.getByText('Desktop')).toBeInTheDocument()
    expect(screen.getByText('Mobile')).toBeInTheDocument()
    expect(screen.getByText('Tablet')).toBeInTheDocument()
  })

  it('should display percentages', () => {
    render(<DevicesPie data={mockData} />)

    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByText(/40%/)).toBeInTheDocument()
    expect(screen.getByText(/10%/)).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<DevicesPie data={[]} />)

    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
