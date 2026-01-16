/**
 * TracesStats 组件测试
 */
import { describe, it, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { TracesStats } from './TracesStats'

describe('TracesStats', () => {
  const mockStats = {
    totalRequests: 1000,
    avgDuration: 150,
    errorRate: 2.5,
    successRate: 97.5,
  }

  afterEach(() => {
    cleanup()
  })

  it('should render stats cards', () => {
    render(<TracesStats stats={mockStats} />)

    expect(screen.getByText('Total Requests')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration')).toBeInTheDocument()
  })

  it('should display total requests', () => {
    render(<TracesStats stats={mockStats} />)

    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('should display average duration with unit', () => {
    render(<TracesStats stats={mockStats} />)

    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('should display error rate', () => {
    render(<TracesStats stats={mockStats} />)

    expect(screen.getByText('2.5%')).toBeInTheDocument()
  })
})
