package analytics

import (
	"sync"
)

// Aggregation 内存中的聚合数据（带 HLL 实例）
type aggregationWithHLL struct {
	*Aggregation
	hll *HLL // 内存中的 HLL 实例
}

// SourceAggregation 内存中的来源聚合数据（带 HLL 实例）
type sourceAggregationWithHLL struct {
	*SourceAggregation
	hll *HLL
}

// DeviceAggregation 内存中的设备聚合数据（带 HLL 实例）
type deviceAggregationWithHLL struct {
	*DeviceAggregation
	hll *HLL
}

// Buffer 是分析事件的内存缓冲区。
// 它实现了 Fork & Flush 架构中的 Fork 部分：
// - Raw Buffer: 存储原始事件，用于写入 Parquet
// - Aggregation Map: 存储聚合数据，用于写入统计表
type Buffer struct {
	maxRawSize int // 原始缓冲区最大字节数

	mu sync.RWMutex

	// rawBuffer 存储原始事件
	rawBuffer []*Event
	rawSize   int // 当前原始缓冲区大小（估算）

	// aggregations 存储按 date+path 聚合的数据
	// key: "2026-01-09|/pricing"
	aggregations map[string]*aggregationWithHLL

	// sourceAggregations 存储按 date+source 聚合的数据
	sourceAggregations map[string]*sourceAggregationWithHLL

	// deviceAggregations 存储按 date+browser+os 聚合的数据
	deviceAggregations map[string]*deviceAggregationWithHLL
}

// NewBuffer 创建一个新的缓冲区。
func NewBuffer(maxRawSize int) *Buffer {
	if maxRawSize <= 0 {
		maxRawSize = 16 * 1024 * 1024 // 默认 16MB
	}

	return &Buffer{
		maxRawSize:         maxRawSize,
		rawBuffer:          make([]*Event, 0, 1024),
		aggregations:       make(map[string]*aggregationWithHLL),
		sourceAggregations: make(map[string]*sourceAggregationWithHLL),
		deviceAggregations: make(map[string]*deviceAggregationWithHLL),
	}
}

// Push 将事件推入缓冲区。
// 事件会同时进入 Raw Buffer 和 Aggregation Map（Fork）。
func (b *Buffer) Push(event *Event) error {
	if event == nil {
		return nil
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	// Fork A: 写入 Raw Buffer
	b.rawBuffer = append(b.rawBuffer, event)
	b.rawSize += b.estimateEventSize(event)

	// Fork B: 更新 Aggregation Map
	b.updateAggregation(event)
	b.updateSourceAggregation(event)
	b.updateDeviceAggregation(event)

	return nil
}

// Len 返回 Raw Buffer 中的事件数量。
func (b *Buffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.rawBuffer)
}

// RawSize 返回 Raw Buffer 的估算大小（字节）。
func (b *Buffer) RawSize() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.rawSize
}

// ShouldFlushRaw 返回是否应该刷新 Raw Buffer。
func (b *Buffer) ShouldFlushRaw() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.rawSize >= b.maxRawSize
}

// DrainRaw 取出并清空 Raw Buffer，返回所有原始事件。
func (b *Buffer) DrainRaw() []*Event {
	b.mu.Lock()
	defer b.mu.Unlock()

	events := b.rawBuffer
	b.rawBuffer = make([]*Event, 0, 1024)
	b.rawSize = 0

	return events
}

// DrainAggregations 取出并清空 Aggregation Map。
// 在返回前，将内存中的 HLL 序列化到 Aggregation.HLL 字段。
func (b *Buffer) DrainAggregations() map[string]*Aggregation {
	b.mu.Lock()
	defer b.mu.Unlock()

	result := make(map[string]*Aggregation, len(b.aggregations))
	for key, aggWithHLL := range b.aggregations {
		// 序列化 HLL 到字节数组
		if aggWithHLL.hll != nil {
			hllBytes, err := aggWithHLL.hll.Bytes()
			if err == nil {
				aggWithHLL.Aggregation.HLL = hllBytes
			}
		}
		result[key] = aggWithHLL.Aggregation
	}

	b.aggregations = make(map[string]*aggregationWithHLL)

	return result
}

// DrainSourceAggregations 取出并清空 Source Aggregation Map。
func (b *Buffer) DrainSourceAggregations() map[string]*SourceAggregation {
	b.mu.Lock()
	defer b.mu.Unlock()

	result := make(map[string]*SourceAggregation, len(b.sourceAggregations))
	for key, aggWithHLL := range b.sourceAggregations {
		// 序列化 HLL 到字节数组
		if aggWithHLL.hll != nil {
			hllBytes, err := aggWithHLL.hll.Bytes()
			if err == nil {
				aggWithHLL.SourceAggregation.HLL = hllBytes
			}
		}
		result[key] = aggWithHLL.SourceAggregation
	}

	b.sourceAggregations = make(map[string]*sourceAggregationWithHLL)

	return result
}

// DrainDeviceAggregations 取出并清空 Device Aggregation Map。
func (b *Buffer) DrainDeviceAggregations() map[string]*DeviceAggregation {
	b.mu.Lock()
	defer b.mu.Unlock()

	result := make(map[string]*DeviceAggregation, len(b.deviceAggregations))
	for key, aggWithHLL := range b.deviceAggregations {
		// 序列化 HLL 到字节数组
		if aggWithHLL.hll != nil {
			hllBytes, err := aggWithHLL.hll.Bytes()
			if err == nil {
				aggWithHLL.DeviceAggregation.HLL = hllBytes
			}
		}
		result[key] = aggWithHLL.DeviceAggregation
	}

	b.deviceAggregations = make(map[string]*deviceAggregationWithHLL)

	return result
}

// AggregationCount 返回聚合条目数量。
func (b *Buffer) AggregationCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.aggregations)
}

// updateAggregation 更新页面聚合数据。
func (b *Buffer) updateAggregation(event *Event) {
	date := event.Timestamp.Format("2006-01-02")
	key := date + "|" + event.Path

	agg, exists := b.aggregations[key]
	if !exists {
		agg = &aggregationWithHLL{
			Aggregation: &Aggregation{
				Date: date,
				Path: event.Path,
			},
			hll: NewHLL(),
		}
		b.aggregations[key] = agg
	}

	agg.PV++
	agg.Count++

	// 添加 SessionID 到 HLL 用于 UV 去重
	if event.SessionID != "" {
		if agg.hll == nil {
			agg.hll = NewHLL()
		}
		agg.hll.Add(event.SessionID)
	}
}

// updateSourceAggregation 更新来源聚合数据。
func (b *Buffer) updateSourceAggregation(event *Event) {
	if event.Referrer == "" {
		return
	}

	date := event.Timestamp.Format("2006-01-02")
	source := extractDomain(event.Referrer)
	if source == "" {
		source = "direct"
	}
	key := date + "|" + source

	agg, exists := b.sourceAggregations[key]
	if !exists {
		agg = &sourceAggregationWithHLL{
			SourceAggregation: &SourceAggregation{
				Date:   date,
				Source: source,
			},
			hll: NewHLL(),
		}
		b.sourceAggregations[key] = agg
	}

	agg.Count++

	// 添加 SessionID 到 HLL 用于 UV 去重
	if event.SessionID != "" {
		if agg.hll == nil {
			agg.hll = NewHLL()
		}
		agg.hll.Add(event.SessionID)
	}
}

// updateDeviceAggregation 更新设备聚合数据。
func (b *Buffer) updateDeviceAggregation(event *Event) {
	date := event.Timestamp.Format("2006-01-02")
	browser := event.Browser
	if browser == "" {
		browser = "Unknown"
	}
	os := event.OS
	if os == "" {
		os = "Unknown"
	}
	key := date + "|" + browser + "|" + os

	agg, exists := b.deviceAggregations[key]
	if !exists {
		agg = &deviceAggregationWithHLL{
			DeviceAggregation: &DeviceAggregation{
				Date:    date,
				Browser: browser,
				OS:      os,
			},
			hll: NewHLL(),
		}
		b.deviceAggregations[key] = agg
	}

	agg.Count++

	// 添加 SessionID 到 HLL 用于 UV 去重
	if event.SessionID != "" {
		if agg.hll == nil {
			agg.hll = NewHLL()
		}
		agg.hll.Add(event.SessionID)
	}
}

// estimateEventSize 估算事件的内存占用（字节）。
func (b *Buffer) estimateEventSize(event *Event) int {
	// 粗略估算：固定开销 + 字符串长度
	size := 200 // 固定开销（指针、时间戳等）
	size += len(event.ID)
	size += len(event.Event)
	size += len(event.UserID)
	size += len(event.SessionID)
	size += len(event.Path)
	size += len(event.Query)
	size += len(event.Referrer)
	size += len(event.Title)
	size += len(event.IP)
	size += len(event.UserAgent)
	size += len(event.Browser)
	size += len(event.OS)
	size += len(event.Device)
	size += len(event.Language)
	// Props 的估算较复杂，简单按 100 字节计算
	if len(event.Props) > 0 {
		size += 100
	}
	return size
}

// extractDomain 从 URL 中提取域名。
func extractDomain(rawURL string) string {
	// 简单实现：去除协议和路径
	url := rawURL

	// 去除协议
	if idx := findString(url, "://"); idx >= 0 {
		url = url[idx+3:]
	}

	// 去除路径
	if idx := findString(url, "/"); idx >= 0 {
		url = url[:idx]
	}

	// 去除端口
	if idx := findString(url, ":"); idx >= 0 {
		url = url[:idx]
	}

	return url
}

// findString 返回子串在字符串中的位置，未找到返回 -1。
func findString(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// RestoreAggregations 将聚合数据放回 buffer（用于重试失败时恢复数据）。
func (b *Buffer) RestoreAggregations(aggs map[string]*Aggregation) {
	if len(aggs) == 0 {
		return
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	for key, agg := range aggs {
		if existing, ok := b.aggregations[key]; ok {
			// 合并数据
			existing.PV += agg.PV
			existing.Count += agg.Count
			existing.Duration += agg.Duration

			// 合并 HLL
			if len(agg.HLL) > 0 {
				if existing.hll == nil {
					existing.hll = NewHLL()
				}
				_ = existing.hll.MergeBytes(agg.HLL)
			}
		} else {
			// 从字节数组恢复 HLL
			var hll *HLL
			if len(agg.HLL) > 0 {
				var err error
				hll, err = NewHLLFromBytes(agg.HLL)
				if err != nil {
					hll = NewHLL()
				}
			} else {
				hll = NewHLL()
			}

			b.aggregations[key] = &aggregationWithHLL{
				Aggregation: agg,
				hll:         hll,
			}
		}
	}
}

// RestoreSourceAggregations 将来源聚合数据放回 buffer。
func (b *Buffer) RestoreSourceAggregations(aggs map[string]*SourceAggregation) {
	if len(aggs) == 0 {
		return
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	for key, agg := range aggs {
		if existing, ok := b.sourceAggregations[key]; ok {
			existing.Count += agg.Count

			// 合并 HLL
			if len(agg.HLL) > 0 {
				if existing.hll == nil {
					existing.hll = NewHLL()
				}
				_ = existing.hll.MergeBytes(agg.HLL)
			}
		} else {
			// 从字节数组恢复 HLL
			var hll *HLL
			if len(agg.HLL) > 0 {
				var err error
				hll, err = NewHLLFromBytes(agg.HLL)
				if err != nil {
					hll = NewHLL()
				}
			} else {
				hll = NewHLL()
			}

			b.sourceAggregations[key] = &sourceAggregationWithHLL{
				SourceAggregation: agg,
				hll:               hll,
			}
		}
	}
}

// RestoreDeviceAggregations 将设备聚合数据放回 buffer。
func (b *Buffer) RestoreDeviceAggregations(aggs map[string]*DeviceAggregation) {
	if len(aggs) == 0 {
		return
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	for key, agg := range aggs {
		if existing, ok := b.deviceAggregations[key]; ok {
			existing.Count += agg.Count

			// 合并 HLL
			if len(agg.HLL) > 0 {
				if existing.hll == nil {
					existing.hll = NewHLL()
				}
				_ = existing.hll.MergeBytes(agg.HLL)
			}
		} else {
			// 从字节数组恢复 HLL
			var hll *HLL
			if len(agg.HLL) > 0 {
				var err error
				hll, err = NewHLLFromBytes(agg.HLL)
				if err != nil {
					hll = NewHLL()
				}
			} else {
				hll = NewHLL()
			}

			b.deviceAggregations[key] = &deviceAggregationWithHLL{
				DeviceAggregation: agg,
				hll:               hll,
			}
		}
	}
}
