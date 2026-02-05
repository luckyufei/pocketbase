package analytics

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

// DailyStat 表示每日统计数据（对应 _analytics_daily 表）
type DailyStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`         // 格式: 2026-01-09
	Path     string         `db:"path" json:"path"`         // 已去参的路径
	TotalPV  int64          `db:"total_pv" json:"total_pv"` // 浏览量
	TotalUV  []byte         `db:"total_uv" json:"-"`        // HLL Sketch (二进制)
	Visitors int64          `db:"visitors" json:"visitors"` // 估算的 UV 值
	AvgDur   int64          `db:"avg_dur" json:"avg_dur"`   // 平均停留时长 (ms)
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// SourceStat 表示来源统计数据（对应 _analytics_sources 表）
type SourceStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`
	Source   string         `db:"source" json:"source"`     // 来源域名
	Visitors int64          `db:"visitors" json:"visitors"` // 访客数
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// DeviceStat 表示设备统计数据（对应 _analytics_devices 表）
type DeviceStat struct {
	ID       string         `db:"id" json:"id"`
	Date     string         `db:"date" json:"date"`
	Browser  string         `db:"browser" json:"browser"`
	OS       string         `db:"os" json:"os"`
	Visitors int64          `db:"visitors" json:"visitors"`
	Created  types.DateTime `db:"created" json:"created"`
	Updated  types.DateTime `db:"updated" json:"updated"`
}

// Aggregation 表示内存中的聚合数据
type Aggregation struct {
	Date     string // 日期
	Path     string // 路径
	PV       int64  // 浏览量
	HLL      []byte // HLL Sketch
	Duration int64  // 总停留时长（用于计算平均值）
	Count    int64  // 事件数（用于计算平均值）
}

// SourceAggregation 表示内存中的来源聚合数据
type SourceAggregation struct {
	Date   string
	Source string
	Count  int64
	HLL    []byte // 用于 UV 去重
}

// DeviceAggregation 表示内存中的设备聚合数据
type DeviceAggregation struct {
	Date    string
	Browser string
	OS      string
	Count   int64
	HLL     []byte // 用于 UV 去重
}
