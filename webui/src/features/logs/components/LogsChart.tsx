/**
 * LogsChart - 日志图表组件
 * 使用 Chart.js 显示日志数量的时间趋势
 * 支持拖拽缩放和重置 - 与 UI 版本对齐
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import zoomPlugin from 'chartjs-plugin-zoom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { ChartDataPoint } from '../store'

// 注册 Chart.js 组件和缩放插件
Chart.register(LineElement, PointElement, LineController, LinearScale, TimeScale, Filler, Tooltip)
Chart.register(zoomPlugin)

/**
 * 格式化时间戳为本地化日期字符串（与 UI 版本一致）
 * 根据是否为当天显示不同格式：
 * - 当天日期：显示时间（如 "12时"）
 * - 非当天日期：显示月日（如 "2月7日"）
 */
function formatLocalizedDate(timestamp: number, lastTimestamp: number | null): string {
  const date = new Date(timestamp)
  const lastDate = lastTimestamp ? new Date(lastTimestamp) : null
  
  // 检查是否是不同的日期（与上一个 tick 比较）
  const isDifferentDay = !lastDate || 
    date.getDate() !== lastDate.getDate() ||
    date.getMonth() !== lastDate.getMonth() ||
    date.getFullYear() !== lastDate.getFullYear()
  
  if (isDifferentDay) {
    // 显示月日格式：2月7日
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  } else {
    // 显示时间格式：12时
    const hours = date.getHours()
    return `${hours}时`
  }
}

interface LogsChartProps {
  data: ChartDataPoint[]
  totalLogs: number
  isLoading?: boolean
  height?: number
  onZoomChange?: (zoom: { min?: string; max?: string }) => void
}

/**
 * 格式化为 UTC 日期字符串
 */
function formatToUTCDate(timestamp: number, format: string): string {
  const date = new Date(timestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')

  if (format === 'yyyy-MM-dd HH') {
    return `${year}-${month}-${day} ${hours}`
  }

  return `${year}-${month}-${day}`
}

export function LogsChart({
  data,
  totalLogs,
  isLoading = false,
  height = 170,
  onZoomChange,
}: LogsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const onZoomChangeRef = useRef(onZoomChange)

  // 保持 onZoomChange 的最新引用
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  // 初始化图表
  useEffect(() => {
    if (!canvasRef.current) return

    const ctx = canvasRef.current

    // 确保先销毁旧的 chart 实例（处理 React 严格模式双重渲染和 HMR）
    // 使用 Chart.getChart() 来获取画布上已存在的实例
    const existingChart = Chart.getChart(ctx)
    if (existingChart) {
      existingChart.destroy()
    }
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Total requests',
            data: [],
            borderColor: '#e34562',
            pointBackgroundColor: '#e34562',
            backgroundColor: 'rgba(239, 69, 101, 0.05)',
            borderWidth: 2,
            pointRadius: 1,
            pointBorderWidth: 0,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        resizeDelay: 250,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#edf0f3',
            },
            border: {
              color: '#e4e9ec',
            },
            ticks: {
              precision: 0,
              maxTicksLimit: 4,
              autoSkip: true,
              color: '#666f75',
            },
          },
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              tooltipFormat: 'PPp', // date-fns 格式
            },
            grid: {
              color: (c: any) => (c.tick?.major ? '#edf0f3' : ''),
            },
            border: {
              color: '#e4e9ec',
            },
            ticks: {
              maxTicksLimit: 15,
              autoSkip: true,
              maxRotation: 0,
              major: {
                enabled: true,
              },
              color: (c: any) => (c.tick?.major ? '#16161a' : '#666f75'),
              callback: function(value: any, index: number, ticks: any[]) {
                // 自定义格式化，与 UI 版本一致
                const timestamp = typeof value === 'number' ? value : new Date(value).getTime()
                const lastTimestamp = index > 0 ? ticks[index - 1].value : null
                return formatLocalizedDate(timestamp, lastTimestamp)
              },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          zoom: {
            zoom: {
              mode: 'x',
              drag: {
                enabled: true,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 0,
                threshold: 10,
              },
              pinch: {
                enabled: true,
              },
              onZoomComplete: ({ chart }) => {
                const isCurrentlyZoomed = chart.isZoomedOrPanned()
                setIsZoomed(isCurrentlyZoomed)

                if (!isCurrentlyZoomed) {
                  // 重置缩放
                  onZoomChangeRef.current?.({})
                } else {
                  // 计算新的时间范围（与 UI 版本一致：按小时截断）
                  const min = formatToUTCDate(chart.scales.x.min, 'yyyy-MM-dd HH') + ':00:00.000Z'
                  const max = formatToUTCDate(chart.scales.x.max, 'yyyy-MM-dd HH') + ':59:59.999Z'
                  onZoomChangeRef.current?.({ min, max })
                }
              },
            },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  // 更新数据
  useEffect(() => {
    if (!chartRef.current) return

    const chartData = data.map((item) => ({
      x: new Date(item.date),
      y: item.total,
    }))

    chartRef.current.data.datasets[0].data = chartData as any
    chartRef.current.update()
  }, [data])

  // 重置缩放
  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
      setIsZoomed(false)
      onZoomChange?.({})
    }
  }, [onZoomChange])

  // 双击重置缩放
  const handleDoubleClick = useCallback(() => {
    handleResetZoom()
  }, [handleResetZoom])

  return (
    <div className="relative" style={{ height }}>
      {/* 日志总数显示 */}
      <div
        className={`absolute right-0 -top-8 text-sm text-slate-400 transition-opacity ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        Found {totalLogs.toLocaleString()} {totalLogs === 1 ? 'log' : 'logs'}
      </div>

      {/* 加载指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* 图表画布 */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full cursor-crosshair ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDoubleClick={handleDoubleClick}
      />

      {/* 重置缩放按钮 */}
      {isZoomed && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-2 top-4 z-10"
          onClick={handleResetZoom}
        >
          Reset zoom
        </Button>
      )}
    </div>
  )
}
