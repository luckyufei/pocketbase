/**
 * Analytics 趋势图
 * 纯 SVG 实现的 PV/UV 折线图
 */
import { useMemo, useRef, useEffect, useState } from 'react'
import type { DailyStats } from '../store'

interface Props {
  data: DailyStats[]
}

const CHART_HEIGHT = 180
const PADDING_TOP = 20
const PADDING_BOTTOM = 30
const PADDING_LEFT = 40
const PADDING_RIGHT = 20

export function AnalyticsChart({ data }: Props) {
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

  // 处理数据
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    // 按日期排序
    return [...data].sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  // 计算最大值
  const maxPV = useMemo(() => Math.max(...chartData.map(d => d.pv), 1), [chartData])
  const maxUV = useMemo(() => Math.max(...chartData.map(d => d.uv), 1), [chartData])
  const maxValue = Math.max(maxPV, maxUV)

  // 计算点坐标
  const getX = (index: number) => {
    const usableWidth = width - PADDING_LEFT - PADDING_RIGHT
    if (chartData.length <= 1) return PADDING_LEFT + usableWidth / 2
    return PADDING_LEFT + (index / (chartData.length - 1)) * usableWidth
  }

  const getY = (value: number) => {
    const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
    return CHART_HEIGHT - PADDING_BOTTOM - (value / maxValue) * usableHeight
  }

  // 生成路径
  const generatePath = (values: number[]) => {
    if (values.length === 0) return ''
    if (values.length === 1) return `M ${getX(0)} ${getY(values[0])}`
    
    let path = `M ${getX(0)} ${getY(values[0])}`
    for (let i = 1; i < values.length; i++) {
      path += ` L ${getX(i)} ${getY(values[i])}`
    }
    return path
  }

  // 生成填充区域路径
  const generateAreaPath = (values: number[]) => {
    if (values.length === 0) return ''
    
    const linePath = generatePath(values)
    const lastX = getX(values.length - 1)
    const firstX = getX(0)
    const bottomY = CHART_HEIGHT - PADDING_BOTTOM
    
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }

  const pvPath = generatePath(chartData.map(d => d.pv))
  const uvPath = generatePath(chartData.map(d => d.uv))
  const pvAreaPath = generateAreaPath(chartData.map(d => d.pv))
  const uvAreaPath = generateAreaPath(chartData.map(d => d.uv))

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => Math.round(maxValue * ratio))

  if (chartData.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
        暂无数据
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg width={width} height={CHART_HEIGHT} className="overflow-visible">
          {/* 网格线 */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PADDING_LEFT}
                y1={getY(tick)}
                x2={width - PADDING_RIGHT}
                y2={getY(tick)}
                stroke="#e2e8f0"
                strokeDasharray="4"
              />
              <text
                x={PADDING_LEFT - 8}
                y={getY(tick) + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400"
              >
                {tick >= 1000 ? (tick / 1000).toFixed(0) + 'k' : tick}
              </text>
            </g>
          ))}

          {/* UV 填充区域 */}
          <path
            d={uvAreaPath}
            fill="url(#uvGradient)"
            opacity={0.3}
          />

          {/* PV 填充区域 */}
          <path
            d={pvAreaPath}
            fill="url(#pvGradient)"
            opacity={0.3}
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

          {/* PV 折线 */}
          <path
            d={pvPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 数据点 */}
          {chartData.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d.pv)}
                r={3}
                fill="#3b82f6"
              />
              <circle
                cx={getX(i)}
                cy={getY(d.uv)}
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
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                className="text-[10px] fill-slate-400"
              >
                {d.date.slice(5)} {/* 只显示 MM-DD */}
              </text>
            )
          })}

          {/* 渐变定义 */}
          <defs>
            <linearGradient id="pvGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="uvGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
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
