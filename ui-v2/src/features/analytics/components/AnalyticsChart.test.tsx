/**
 * AnalyticsChart 组件测试
 */
import { describe, it, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { AnalyticsChart } from './AnalyticsChart'

describe('AnalyticsChart', () => {
  const mockData = [
    { date: '2024-01-01', pageViews: 100, visitors: 50 },
    { date: '2024-01-02', pageViews: 150, visitors: 75 },
    { date: '2024-01-03', pageViews: 120, visitors: 60 },
  ]

  it('should render chart container', () => {
    render(<AnalyticsChart data={mockData} />)

    expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
  })

  it('should show empty state when no data', () => {
    render(<AnalyticsChart data={[]} />)

    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })

  it('should display legend', () => {
    render(<AnalyticsChart data={mockData} />)

    expect(screen.getByText(/page views/i)).toBeInTheDocument()
    expect(screen.getByText(/visitors/i)).toBeInTheDocument()
  })
})
