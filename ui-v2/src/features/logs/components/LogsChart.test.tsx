/**
 * LogsChart 组件测试
 */
import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { LogsChart } from './LogsChart'

describe('LogsChart', () => {
  const mockData = [
    { time: '2024-01-01T00:00:00Z', count: 10 },
    { time: '2024-01-01T01:00:00Z', count: 25 },
    { time: '2024-01-01T02:00:00Z', count: 15 },
  ]

  it('should render chart container', () => {
    render(<LogsChart data={mockData} />)

    expect(screen.getByTestId('logs-chart')).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<LogsChart data={[]} />)

    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })

  it('should render with custom height', () => {
    render(<LogsChart data={mockData} height={300} />)

    const chart = screen.getByTestId('logs-chart')
    expect(chart).toBeInTheDocument()
  })
})
