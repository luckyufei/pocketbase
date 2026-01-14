/**
 * MetricsChart 组件测试
 */
import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MetricsChart } from './MetricsChart'

describe('MetricsChart', () => {
  const mockData = [
    { time: '2024-01-01T00:00:00Z', value: 45 },
    { time: '2024-01-01T01:00:00Z', value: 60 },
    { time: '2024-01-01T02:00:00Z', value: 55 },
  ]

  it('should render chart container', () => {
    render(<MetricsChart data={mockData} title="CPU Usage" />)

    expect(screen.getByTestId('metrics-chart')).toBeInTheDocument()
  })

  it('should display title', () => {
    render(<MetricsChart data={mockData} title="CPU Usage" />)

    expect(screen.getByText('CPU Usage')).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<MetricsChart data={[]} title="Memory" />)

    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })

  it('should display unit when provided', () => {
    render(<MetricsChart data={mockData} title="CPU" unit="%" />)

    expect(screen.getByText('%')).toBeInTheDocument()
  })
})
