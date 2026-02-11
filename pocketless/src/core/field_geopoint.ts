/**
 * GeoPointField — 地理坐标字段
 * 与 Go 版 core/field_geo_point.go 对齐
 * 存储 {lon, lat} JSON 格式
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export interface GeoPointValue {
  lon: number;
  lat: number;
}

export class GeoPointField implements Field {
  id: string;
  name: string;
  type = "geoPoint";
  system: boolean;
  hidden: boolean;
  required: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
  }

  columnType(isPostgres?: boolean): string {
    if (isPostgres) return `JSONB DEFAULT '{"lon":0,"lat":0}' NOT NULL`;
    return `JSON DEFAULT '{"lon":0,"lat":0}' NOT NULL`;
  }

  prepareValue(raw: unknown): GeoPointValue {
    if (raw === null || raw === undefined) return { lon: 0, lat: 0 };
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      return {
        lon: Number(obj.lon ?? obj.longitude ?? 0),
        lat: Number(obj.lat ?? obj.latitude ?? 0),
      };
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return {
          lon: Number(parsed.lon ?? parsed.longitude ?? 0),
          lat: Number(parsed.lat ?? parsed.latitude ?? 0),
        };
      } catch {
        return { lon: 0, lat: 0 };
      }
    }
    return { lon: 0, lat: 0 };
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const point = value as GeoPointValue;
    if (!point) {
      if (this.required) return "不能为空";
      return null;
    }
    if (point.lat === 0 && point.lon === 0 && this.required) return "不能为空";
    if (point.lat < -90 || point.lat > 90) return "纬度必须在 -90 到 90 之间";
    if (point.lon < -180 || point.lon > 180) return "经度必须在 -180 到 180 之间";
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }

  driverValue(value: unknown): string {
    const point = value as GeoPointValue;
    return JSON.stringify({ lon: point?.lon ?? 0, lat: point?.lat ?? 0 });
  }
}

registerField("geoPoint", (opts) => new GeoPointField(opts));
