/**
 * MetricsChart - 指标图表组件
 * 与 ui 版本 MetricsChart.svelte 一致
 * 使用 Chart.js 渲染时间趋势图
 */
import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  TimeScale,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'
import type { SystemMetrics } from '../store'

// 注册 Chart.js 组件
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, TimeScale)

interface MetricsChartProps {
  data: SystemMetrics[]
  metric: keyof SystemMetrics
  title: string
  unit?: string
  color?: string
}

export function MetricsChart({
  data,
  metric,
  title,
  unit = '',
  color = '#3b82f6',
}: MetricsChartProps) {
  const chartData = {
    labels: data.map((d) => new Date(d.timestamp)),
    datasets: [
      {
        label: title,
        data: data.map((d) => (d[metric] as number) || 0),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${title}: ${context.parsed.y.toFixed(2)} ${unit}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          tooltipFormat: 'yyyy-MM-dd HH:mm',
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM-dd',
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: (value: any) => `${value}${unit}`,
        },
      },
    },
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h4 className="text-sm font-medium text-slate-900 mb-3">{title}</h4>
      <div className="h-[200px] relative">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}

export default MetricsChart
