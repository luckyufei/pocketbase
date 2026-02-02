package trace

import (
	"context"
	"strings"
	"sync"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/trace/dye"
)

// tracerRegistry 存储每个 App 实例的 Tracer
var (
	tracerRegistry = make(map[core.App]Tracer)
	tracerMu       sync.RWMutex
)

// MustRegister 注册 trace 插件，失败时 panic
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册 trace 插件
func Register(app core.App, config Config) error {
	// 应用环境变量覆盖
	config = applyEnvOverrides(config)

	// 应用默认值
	config = applyDefaults(config)

	var tracer Tracer

	// 如果模式为 Off，注册 NoopTracer
	if config.Mode == ModeOff {
		tracer = NewNoopTrace()
	} else {
		// 创建 Tracer 实例
		tracer = newTracer(config)
	}

	// 注册到全局 registry
	tracerMu.Lock()
	tracerRegistry[app] = tracer
	tracerMu.Unlock()

	// 注册清理钩子
	app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		tracerMu.Lock()
		if t, ok := tracerRegistry[app]; ok {
			_ = t.Close()
			delete(tracerRegistry, app)
		}
		tracerMu.Unlock()
		return e.Next()
	})

	return nil
}

// GetTracer 获取指定 App 的 Tracer
// 如果未注册，返回 NoopTracer
func GetTracer(app core.App) Tracer {
	tracerMu.RLock()
	defer tracerMu.RUnlock()
	if t, ok := tracerRegistry[app]; ok {
		return t
	}
	return NewNoopTrace()
}

// newTracer 创建一个新的 Tracer 实例
func newTracer(config Config) *traceImpl {
	tracer := &traceImpl{
		config: config,
	}

	// 初始化 DyeStore
	if config.DyeMaxUsers > 0 {
		tracer.dyeStore = dye.NewMemoryDyeStore(config.DyeMaxUsers, config.DyeDefaultTTL)

		// 预设染色用户
		for _, userID := range config.DyeUsers {
			if strings.TrimSpace(userID) != "" {
				_ = tracer.dyeStore.Add(userID, config.DyeDefaultTTL, "config", "preset")
			}
		}
	}

	return tracer
}

// traceImpl 是 Tracer 接口的实现
type traceImpl struct {
	config   Config
	dyeStore dye.DyeStore
}

// DyeStore 返回染色存储
func (t *traceImpl) DyeStore() dye.DyeStore {
	return t.dyeStore
}

func (t *traceImpl) StartSpan(ctx context.Context, name string) (context.Context, SpanBuilder) {
	// TODO: Phase 2 实现完整的 Span 创建
	return ctx, &NoopSpanBuilder{}
}

func (t *traceImpl) RecordSpan(span *Span) {
	// TODO: Phase 2 实现 Span 记录
}

func (t *traceImpl) IsEnabled() bool {
	return t.config.Mode != ModeOff
}

func (t *traceImpl) Flush() {
	// TODO: Phase 2 实现缓冲区刷新
}

func (t *traceImpl) Prune() (int64, error) {
	// TODO: Phase 2 实现数据清理
	return 0, nil
}

func (t *traceImpl) Close() error {
	if t.dyeStore != nil {
		return t.dyeStore.Close()
	}
	return nil
}

// 确保实现了 Tracer 接口
var _ Tracer = (*traceImpl)(nil)
