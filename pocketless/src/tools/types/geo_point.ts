/**
 * GeoPoint — 地理坐标点
 * 与 Go 版 types.GeoPoint 对齐
 */

export class GeoPoint {
  lon: number;
  lat: number;

  constructor(lon: number = 0, lat: number = 0) {
    this.lon = lon;
    this.lat = lat;
  }

  /** JSON 序列化 */
  toJSON(): { lon: number; lat: number } {
    return { lon: this.lon, lat: this.lat };
  }

  /** 从 JSON 解析 */
  static fromJSON(data: unknown): GeoPoint {
    if (data && typeof data === "object" && "lon" in data && "lat" in data) {
      const obj = data as { lon: number; lat: number };
      return new GeoPoint(Number(obj.lon) || 0, Number(obj.lat) || 0);
    }
    return new GeoPoint();
  }

  /** 字符串表示 */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
