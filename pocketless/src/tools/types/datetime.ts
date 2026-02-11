/**
 * DateTime — 自定义日期时间类型
 * 与 Go 版 types.DateTime 对齐
 */

export class DateTime {
  private _time: Date;

  constructor(value?: Date | string | number) {
    if (value instanceof Date) {
      this._time = new Date(value.getTime());
    } else if (typeof value === "string" && value !== "") {
      this._time = new Date(value);
    } else if (typeof value === "number") {
      this._time = new Date(value);
    } else {
      this._time = new Date(0);
    }
  }

  /** 是否为零值 */
  isZero(): boolean {
    return this._time.getTime() === 0;
  }

  /** 获取原生 Date */
  time(): Date {
    return new Date(this._time.getTime());
  }

  /** ISO 格式字符串（与 Go 版一致：YYYY-MM-DD HH:mm:ss.SSSZ） */
  string(): string {
    if (this.isZero()) return "";
    return this._time.toISOString().replace("T", " ").replace("Z", "Z");
  }

  /** SQLite 存储格式 */
  toSQLite(): string {
    if (this.isZero()) return "";
    return this._time.toISOString().replace("T", " ").slice(0, 23) + "Z";
  }

  /** JSON 序列化 */
  toJSON(): string {
    return this.string();
  }

  /** 创建当前时间 */
  static now(): DateTime {
    return new DateTime(new Date());
  }

  /** 从字符串解析 */
  static parse(str: string): DateTime {
    if (!str || str === "") return new DateTime();
    // 处理 Go 版格式 "YYYY-MM-DD HH:mm:ss.SSSZ"
    const normalized = str.includes("T") ? str : str.replace(" ", "T");
    return new DateTime(new Date(normalized));
  }
}
