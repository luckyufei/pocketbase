/**
 * GeoPointField - 地理坐标字段组件
 *
 * 支持：
 * - 经纬度数字输入
 * - 地图选点（使用 Leaflet）
 * - 地址搜索
 * - 坐标范围验证
 */
import { useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Map, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// 懒加载地图组件
const LeafletMap = lazy(() => import('./LeafletMap'))

interface GeoPoint {
  lat: number
  lon: number
}

interface GeoPointFieldProps {
  field: {
    id?: string
    name: string
    type: string
    required?: boolean
  }
  value: GeoPoint | undefined
  onChange: (value: GeoPoint) => void
  disabled?: boolean
  className?: string
}

// 坐标范围限制
function normalizeCoordinate(value: number, min: number, max: number): number {
  if (isNaN(value)) return 0
  return Math.max(min, Math.min(max, value))
}

export function GeoPointField({
  field,
  value,
  onChange,
  disabled = false,
  className,
}: GeoPointFieldProps) {
  const [isMapVisible, setIsMapVisible] = useState(false)

  // 确保值存在
  const point = useMemo(
    () => ({
      lat: value?.lat ?? 0,
      lon: value?.lon ?? 0,
    }),
    [value]
  )

  const handleLatChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newLat = parseFloat(e.target.value) || 0
      const normalizedLat = normalizeCoordinate(newLat, -90, 90)
      onChange({ ...point, lat: normalizedLat })
    },
    [point, onChange]
  )

  const handleLonChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newLon = parseFloat(e.target.value) || 0
      const normalizedLon = normalizeCoordinate(newLon, -180, 180)
      onChange({ ...point, lon: normalizedLon })
    },
    [point, onChange]
  )

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      onChange({
        lat: normalizeCoordinate(lat, -90, 90),
        lon: normalizeCoordinate(lon, -180, 180),
      })
    },
    [onChange]
  )

  const toggleMap = useCallback(() => {
    setIsMapVisible((prev) => !prev)
  }, [])

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="flex items-center gap-1">
        <MapPin className="h-4 w-4" />
        <span>{field.name}</span>
        {field.required && <span className="text-destructive">*</span>}
      </Label>

      {/* 坐标输入区域 */}
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
        <div className="flex-1 flex items-center gap-2">
          <Label
            htmlFor={`${field.name}-lon`}
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Longitude:
          </Label>
          <Input
            id={`${field.name}-lon`}
            type="number"
            value={point.lon}
            onChange={handleLonChange}
            disabled={disabled}
            min={-180}
            max={180}
            step="any"
            placeholder="0"
            className="h-8"
            aria-label="Longitude"
          />
        </div>

        <div className="w-px h-6 bg-border" />

        <div className="flex-1 flex items-center gap-2">
          <Label
            htmlFor={`${field.name}-lat`}
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Latitude:
          </Label>
          <Input
            id={`${field.name}-lat`}
            type="number"
            value={point.lat}
            onChange={handleLatChange}
            disabled={disabled}
            min={-90}
            max={90}
            step="any"
            placeholder="0"
            className="h-8"
            aria-label="Latitude"
          />
        </div>

        <div className="w-px h-6 bg-border" />

        <Button
          type="button"
          variant={isMapVisible ? 'secondary' : 'ghost'}
          size="sm"
          onClick={toggleMap}
          disabled={disabled}
          aria-label="Toggle map"
          className="h-8 w-8 p-0"
        >
          <Map className="h-4 w-4" />
        </Button>
      </div>

      {/* 地图区域 */}
      {isMapVisible && (
        <div className="h-[200px] rounded-md overflow-hidden border">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <LeafletMap
              lat={point.lat}
              lon={point.lon}
              onLocationChange={handleMapClick}
              disabled={disabled}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default GeoPointField
