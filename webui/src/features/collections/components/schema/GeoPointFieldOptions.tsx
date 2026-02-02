// T018: GeoPoint 字段选项组件
// GeoPoint 类型没有额外的选项配置

export interface GeoPointField {
  name: string
  type: 'geoPoint'
  [key: string]: unknown
}

interface GeoPointFieldOptionsProps {
  field: GeoPointField
  onChange: (field: GeoPointField) => void
}

export function GeoPointFieldOptions({
  field: _field,
  onChange: _onChange,
}: GeoPointFieldOptionsProps) {
  return (
    <div className="text-sm text-muted-foreground py-2">
      No additional options for geo point fields.
    </div>
  )
}
