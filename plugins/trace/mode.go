// Package trace 提供可观测性追踪功能的插件化实现
package trace

// TraceMode 定义追踪模式
type TraceMode string

const (
	// ModeOff 关闭追踪
	ModeOff TraceMode = "off"
	// ModeConditional 条件采集模式（根据过滤器决定是否采集）
	ModeConditional TraceMode = "conditional"
	// ModeFull 全量采集模式
	ModeFull TraceMode = "full"
)

// IsValid 检查模式是否有效
func (m TraceMode) IsValid() bool {
	switch m {
	case ModeOff, ModeConditional, ModeFull:
		return true
	default:
		return false
	}
}

// String 返回模式字符串
func (m TraceMode) String() string {
	return string(m)
}
