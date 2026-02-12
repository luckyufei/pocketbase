/**
 * Analytics 趋势图
 * 纯 SVG 实现的 PV/UV 折线图
 */
import { useMemo, useRef, useEffect, useState } from 'react'
import type { DailyStats } from '../store'

interface Props {
  data: DailyStats[]
  days?: number
}

const CHART_HEIGHT = 200
const PADDING_TOP = 20
const PADDING_BOTTOM = 30
const PADDING_LEFT = 40
const PADDING_RIGHT = 40

/**
 * 格式化日期为 MM-DD 格式
 */
function formatDate(d: Date): string {
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${month}-${day}`
}

/**
 * 处理数据：如果数据为空，生成占位日期数据
 */
function processData(raw: DailyStats[], days: number): DailyStats[] {
  if (!raw || raw.length === 0) {
    // Generate empty data with dates
    const result: DailyStats[] = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      result.push({
        date: formatDate(d),
        pv: 0,
        uv: 0,
      })
    }
    return result
  }
  // Sort by date
  return [...raw].sort((a, b) => a.date.localeCompare(b.date))
}

export function AnalyticsChart({ data, days = 7 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // 监听容器宽度变化
  useEffect(() => {
    if (!containerRef.current) return
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(entry.contentRect.width)
      }
    })
    
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // 处理数据（当数据为空时生成占位数据）
  const chartData = useMemo(() => processData(data, days), [data, days])

  // 计算最大值
  const maxPV = useMemo(() => Math.max(...chartData.map(d => d.pv), 1), [chartData])
  const maxUV = useMemo(() => Math.max(...chartData.map(d => d.uv), 1), [chartData])

  // 计算点坐标
  const getX = (index: number) => {
    const usableWidth = width - PADDING_LEFT - PADDING_RIGHT
    if (chartData.length <= 1) return PADDING_LEFT + usableWidth / 2
    const step = usableWidth / Math.max(chartData.length - 1, 1)
    return PADDING_LEFT + index * step
  }

  const getYPV = (value: number) => {
    const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
    return CHART_HEIGHT - PADDING_BOTTOM - (value / maxPV) * usableHeight
  }

  const getYUV = (value: number) => {
    const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
    return CHART_HEIGHT - PADDING_BOTTOM - (value / maxUV) * usableHeight
  }

  // 生成路径
  const generatePath = (values: number[], getY: (v: number) => number) => {
    if (values.length === 0) return ''
    if (values.length === 1) return `M ${getX(0)} ${getY(values[0])}`
    
    let path = `M ${getX(0)} ${getY(values[0])}`
    for (let i = 1; i < values.length; i++) {
      path += ` L ${getX(i)} ${getY(values[i])}`
    }
    return path
  }

  const pvPath = generatePath(chartData.map(d => d.pv), getYPV)
  const uvPath = generatePath(chartData.map(d => d.uv), getYUV)

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg width={width} height={CHART_HEIGHT} className="overflow-visible">
          {/* 网格线 */}
          {yTicks.map((ratio, i) => (
            <line
              key={i}
              x1={PADDING_LEFT}
              y1={CHART_HEIGHT - PADDING_BOTTOM - ratio * (CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)}
              x2={width - PADDING_RIGHT}
              y2={CHART_HEIGHT - PADDING_BOTTOM - ratio * (CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)}
              stroke="#e2e8f0"
              strokeDasharray="4"
            />
          ))}

          {/* PV 折线 */}
          <path
            d={pvPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* UV 折线 */}
          <path
            d={uvPath}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 数据点 */}
          {chartData.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getYPV(d.pv)}
                r={3}
                fill="#3b82f6"
              />
              <circle
                cx={getX(i)}
                cy={getYUV(d.uv)}
                r={3}
                fill="#10b981"
              />
            </g>
          ))}

          {/* X 轴标签 */}
          {chartData.map((d, i) => {
            // 只显示部分标签避免重叠
            const showLabel = chartData.length <= 7 || 
              i === 0 || 
              i === chartData.length - 1 ||
              i % Math.ceil(chartData.length / 7) === 0
            
            if (!showLabel) return null
            
            return (
              <text
                key={i}
                x={getX(i)}
                y={CHART_HEIGHT - 5}
                textAnchor="middle"
                className="text-[10px] fill-slate-400"
              >
                {d.date}
              </text>
            )
          })}
        </svg>
      )}

      {/* 图例 */}
      <div className="flex justify-center gap-6 mt-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
          PV
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          UV
        </span>
      </div>
    </div>
  )
}
