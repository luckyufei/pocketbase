/**
 * LeafletMap - Leaflet 地图组件
 *
 * 用于 GeoPointField 的地图选点功能
 */
import { useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// 修复 Leaflet 默认图标问题
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// 设置默认图标
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

interface LeafletMapProps {
  lat: number
  lon: number
  onLocationChange: (lat: number, lon: number) => void
  disabled?: boolean
}

// 地图事件处理组件
function MapEventHandler({
  onLocationChange,
  disabled,
}: {
  onLocationChange: (lat: number, lon: number) => void
  disabled?: boolean
}) {
  useMapEvents({
    contextmenu: (e) => {
      if (!disabled) {
        onLocationChange(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)))
      }
    },
  })
  return null
}

// 地图视图更新组件
function MapViewUpdater({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  const prevPosition = useRef({ lat, lon })

  useEffect(() => {
    if (prevPosition.current.lat !== lat || prevPosition.current.lon !== lon) {
      map.panTo([lat, lon], { animate: true })
      prevPosition.current = { lat, lon }
    }
  }, [lat, lon, map])

  return null
}

// 可拖拽标记组件
function DraggableMarker({
  lat,
  lon,
  onLocationChange,
  disabled,
}: {
  lat: number
  lon: number
  onLocationChange: (lat: number, lon: number) => void
  disabled?: boolean
}) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = {
    dragend: () => {
      const marker = markerRef.current
      if (marker && !disabled) {
        const latlng = marker.getLatLng()
        onLocationChange(parseFloat(latlng.lat.toFixed(6)), parseFloat(latlng.lng.toFixed(6)))
      }
    },
  }

  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      draggable={!disabled}
      eventHandlers={eventHandlers}
    />
  )
}

export function LeafletMap({ lat, lon, onLocationChange, disabled = false }: LeafletMapProps) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <DraggableMarker
        lat={lat}
        lon={lon}
        onLocationChange={onLocationChange}
        disabled={disabled}
      />
      <MapEventHandler onLocationChange={onLocationChange} disabled={disabled} />
      <MapViewUpdater lat={lat} lon={lon} />
    </MapContainer>
  )
}

export default LeafletMap
