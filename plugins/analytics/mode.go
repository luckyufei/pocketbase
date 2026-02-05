package analytics

// AnalyticsMode 定义分析插件的运行模式
type AnalyticsMode string

const (
	// ModeOff 关闭分析功能，所有操作为 NoOp
	ModeOff AnalyticsMode = "off"

	// ModeConditional 条件模式，根据配置决定是否采集（默认）
	ModeConditional AnalyticsMode = "conditional"

	// ModeFull 全量模式，采集所有事件
	ModeFull AnalyticsMode = "full"
)

// IsValid 检查模式是否有效
func (m AnalyticsMode) IsValid() bool {
	switch m {
	case ModeOff, ModeConditional, ModeFull:
		return true
	default:
		return false
	}
}

// String 返回模式的字符串表示
func (m AnalyticsMode) String() string {
	return string(m)
}
