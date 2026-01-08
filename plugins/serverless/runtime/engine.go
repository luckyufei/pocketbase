package runtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/runtime/quickjs"
)

// ExecuteResult 表示 JS 执行结果
type ExecuteResult struct {
	// Value 返回值的字符串表示
	Value string

	// Logs 执行期间捕获的 console 输出
	Logs []LogEntry

	// Duration 执行耗时
	Duration time.Duration
}

// LogEntry 表示一条日志记录
type LogEntry struct {
	Level   string    // log, warn, error, info, debug
	Message string    // 日志消息
	Args    []any     // 额外参数
	Time    time.Time // 记录时间
}

// Engine 是 WASM 运行时引擎
type Engine struct {
	mu      sync.Mutex
	runtime *quickjs.Runtime
	ready   bool
}

// NewEngine 创建新的 WASM 引擎实例
func NewEngine() (*Engine, error) {
	rt, err := quickjs.NewRuntime()
	if err != nil {
		return nil, fmt.Errorf("创建 QuickJS 运行时失败: %w", err)
	}

	engine := &Engine{
		runtime: rt,
		ready:   true,
	}

	return engine, nil
}

// Close 关闭引擎并释放资源
func (e *Engine) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.ready = false
	if e.runtime != nil {
		return e.runtime.Close()
	}
	return nil
}

// IsReady 检查引擎是否就绪
func (e *Engine) IsReady() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.ready
}

// Execute 执行 JavaScript 代码
func (e *Engine) Execute(ctx context.Context, code string, cfg RuntimeConfig) (*ExecuteResult, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("无效配置: %w", err)
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.ready {
		return nil, errors.New("引擎未就绪")
	}

	start := time.Now()

	// 创建带超时的上下文
	execCtx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	// 创建日志收集器
	logs := make([]LogEntry, 0)
	logCollector := func(level, msg string, args []any) {
		logs = append(logs, LogEntry{
			Level:   level,
			Message: msg,
			Args:    args,
			Time:    time.Now(),
		})
	}

	// 执行代码
	result, err := e.runtime.Eval(execCtx, code, quickjs.EvalOptions{
		MaxMemory:       cfg.MaxMemory,
		MaxInstructions: cfg.MaxInstructions,
		OnConsole:       logCollector,
	})
	if err != nil {
		return nil, err
	}

	return &ExecuteResult{
		Value:    result,
		Logs:     logs,
		Duration: time.Since(start),
	}, nil
}

// Reset 重置引擎状态，准备下一次执行
func (e *Engine) Reset() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.runtime != nil {
		return e.runtime.Reset()
	}
	return nil
}
