// Package core 提供 Native Analytics 的核心数据结构和处理逻辑。
package core

import (
	"time"
)

// AnalyticsEvent 表示一个原始分析事件，对应 Parquet Schema。
// 该结构体用于接收前端 SDK 发送的事件数据，并在内存中暂存。
type AnalyticsEvent struct {
	// ID 是事件的唯一标识符，使用 UUID v7（可排序）
	ID string `json:"id"`

	// Timestamp 是事件发生的时间戳
	Timestamp time.Time `json:"ts"`

	// Event 是事件名称，如 "page_view", "click_buy" 等
	Event string `json:"event"`

	// UserID 是 Hangar 用户 ID（如果已登录）
	UserID string `json:"uid,omitempty"`

	// SessionID 是会话 ID，用于关联同一会话的事件
	SessionID string `json:"sid"`

	// Path 是页面路径（已去参）
	Path string `json:"path"`

	// Query 是 URL 查询参数（原始保留，用于深度分析）
	Query string `json:"query,omitempty"`

	// Referrer 是来源 URL
	Referrer string `json:"referrer,omitempty"`

	// Title 是页面标题
	Title string `json:"title,omitempty"`

	// IP 是客户端 IP 地址
	IP string `json:"ip,omitempty"`

	// UserAgent 是原始 User-Agent 字符串
	UserAgent string `json:"ua,omitempty"`

	// Browser 是解析后的浏览器名称
	Browser string `json:"browser,omitempty"`

	// OS 是解析后的操作系统名称
	OS string `json:"os,omitempty"`

	// Device 是设备类型（desktop, mobile, tablet）
	Device string `json:"device,omitempty"`

	// Language 是浏览器语言
	Language string `json:"lang,omitempty"`

	// Props 是业务自定义属性（JSON 格式）
	Props map[string]any `json:"props,omitempty"`

	// PerfMs 是页面加载耗时（毫秒）
	PerfMs int32 `json:"perf_ms,omitempty"`
}

// AnalyticsEventBatch 表示一批分析事件，用于批量接收和处理。
type AnalyticsEventBatch struct {
	Events []AnalyticsEvent `json:"events"`
}

// Validate 验证事件的必填字段。
func (e *AnalyticsEvent) Validate() error {
	if e.Event == "" {
		return ErrAnalyticsEventRequired
	}
	if e.Path == "" {
		return ErrAnalyticsPathRequired
	}
	if e.SessionID == "" {
		return ErrAnalyticsSessionRequired
	}
	return nil
}

// AnalyticsEventInput 表示前端 SDK 发送的原始事件输入。
// 与 AnalyticsEvent 的区别是时间戳使用毫秒数，便于 JSON 传输。
type AnalyticsEventInput struct {
	Event     string         `json:"event"`
	Timestamp int64          `json:"ts,omitempty"` // 毫秒时间戳
	UserID    string         `json:"uid,omitempty"`
	SessionID string         `json:"sid"`
	Path      string         `json:"path"`
	Query     string         `json:"query,omitempty"`
	Referrer  string         `json:"referrer,omitempty"`
	Title     string         `json:"title,omitempty"`
	Language  string         `json:"lang,omitempty"`
	Props     map[string]any `json:"props,omitempty"`
	PerfMs    int32          `json:"perf_ms,omitempty"`
}

// ToEvent 将输入转换为 AnalyticsEvent，填充服务端字段。
func (i *AnalyticsEventInput) ToEvent(id, ip, ua, browser, os, device string) AnalyticsEvent {
	ts := time.Now()
	if i.Timestamp > 0 {
		ts = time.UnixMilli(i.Timestamp)
	}

	return AnalyticsEvent{
		ID:        id,
		Timestamp: ts,
		Event:     i.Event,
		UserID:    i.UserID,
		SessionID: i.SessionID,
		Path:      i.Path,
		Query:     i.Query,
		Referrer:  i.Referrer,
		Title:     i.Title,
		IP:        ip,
		UserAgent: ua,
		Browser:   browser,
		OS:        os,
		Device:    device,
		Language:  i.Language,
		Props:     i.Props,
		PerfMs:    i.PerfMs,
	}
}
