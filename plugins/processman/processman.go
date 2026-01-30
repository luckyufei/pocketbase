// Package processman 提供 PocketBase 的进程管理插件
package processman

import (
	"context"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ProcessManager 插件核心管理器
// 映射 spec.md Key Entities: ProcessManager
type ProcessManager struct {
	app        core.App
	config     Config
	configs    []*ProcessConfig
	states     map[string]*ProcessState
	logBuffers map[string]*LogBuffer // 每个进程的日志缓冲区
	mu         sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
}

// MustRegister 注册插件（失败时 panic）
func MustRegister(app core.App, config Config) {
	if err := Register(app, config); err != nil {
		panic(err)
	}
}

// Register 注册插件
func Register(app core.App, config Config) error {
	pm := New(app, config)
	return pm.Start()
}

// New 创建 ProcessManager 实例
func New(app core.App, config Config) *ProcessManager {
	if config.ConfigFile == "" {
		config.ConfigFile = "pb_processes.json"
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &ProcessManager{
		app:        app,
		config:     config,
		states:     make(map[string]*ProcessState),
		logBuffers: make(map[string]*LogBuffer),
		ctx:        ctx,
		cancel:     cancel,
	}
}

// Start 启动插件（注册生命周期钩子）
func (pm *ProcessManager) Start() error {
	if pm.app == nil {
		return nil // 测试模式，不注册钩子
	}

	// 1. PB 启动时启动所有子进程
	pm.app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		pm.app.Logger().Info("ProcessManager starting",
			"configFile", pm.config.ConfigFile)

		// 加载配置文件
		if err := pm.loadConfig(); err != nil {
			pm.app.Logger().Warn("Failed to load process config", "error", err)
			// 配置加载失败不阻止 PB 启动 - User Story 5: Scenario 3
		}

		// 注册 API 路由
		pm.registerRoutes(e)

		// 启动所有配置的进程
		for _, cfg := range pm.configs {
			go pm.supervise(cfg)

			// 如果开启了开发模式，启动文件监听 (T2.4)
			if cfg.DevMode {
				go pm.watch(cfg)
			}
		}

		return e.Next()
	})

	// 2. PB 退出时清理所有子进程
	pm.app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
		pm.app.Logger().Info("ProcessManager shutting down")
		pm.Stop()
		return e.Next()
	})

	return nil
}

// Register 注册单个进程配置（代码配置方式）
func (pm *ProcessManager) Register(cfg ProcessConfig) {
	pm.configs = append(pm.configs, &cfg)
}

// Stop 停止 ProcessManager（触发所有 supervisor goroutine 退出）
func (pm *ProcessManager) Stop() {
	pm.cancel() // 触发 context 取消
	pm.KillAll()
}

// GetState 获取指定进程的状态（线程安全，返回副本）
func (pm *ProcessManager) GetState(id string) *ProcessState {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	if state, exists := pm.states[id]; exists {
		// 返回副本避免数据竞争
		copy := *state
		return &copy
	}
	return nil
}

// GetAllStates 获取所有进程状态（返回副本）
func (pm *ProcessManager) GetAllStates() []*ProcessState {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]*ProcessState, 0, len(pm.states))
	for _, state := range pm.states {
		// 返回副本避免数据竞争
		copy := *state
		result = append(result, &copy)
	}
	return result
}

// updateState 更新进程状态（线程安全）
func (pm *ProcessManager) updateState(id, status string, pid int, lastError string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	state, exists := pm.states[id]
	if !exists {
		state = &ProcessState{ID: id}
		pm.states[id] = state
	}

	state.Status = status
	state.PID = pid
	state.LastError = lastError

	if status == "running" {
		state.StartTime = time.Now()
	}
	if status == "crashed" || status == "stopped" {
		state.RestartCount++
	}
}

// calculateBackoff 计算指数退避延迟
// User Story 2:
//   - Scenario 2: 1s -> 2s -> 4s 指数增长
//   - Scenario 3: 上限 30s
func (pm *ProcessManager) calculateBackoff(base time.Duration, failCount int) time.Duration {
	if failCount <= 0 {
		return 0 // 健康运行后立即重启
	}

	// 指数退避: base * 2^(failCount-1)
	backoff := base
	for i := 1; i < failCount; i++ {
		backoff *= 2
		if backoff > 30*time.Second {
			break
		}
	}

	// 上限 30 秒
	if backoff > 30*time.Second {
		backoff = 30 * time.Second
	}

	return backoff
}

// parseBackoff 解析 backoff 字符串为 Duration
func (pm *ProcessManager) parseBackoff(s string) time.Duration {
	if s == "" {
		return 1 * time.Second // 默认 1s
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		if pm.app != nil {
			pm.app.Logger().Warn("Invalid backoff format, using default", "backoff", s)
		}
		return 1 * time.Second
	}
	return d
}

// StartProcess 启动已停止的进程
// 映射 FR-003: 系统 MUST 支持对单个进程执行: 启动、停止、重启操作
func (pm *ProcessManager) StartProcess(id string) error {
	// 检查进程配置是否存在
	var cfg *ProcessConfig
	for _, c := range pm.configs {
		if c.ID == id {
			cfg = c
			break
		}
	}
	if cfg == nil {
		return ErrProcessNotFound
	}

	// 检查进程是否已在运行
	pm.mu.RLock()
	state := pm.states[id]
	pm.mu.RUnlock()

	if state != nil && state.Status == "running" {
		return ErrProcessAlreadyRunning
	}

	// 重置状态，准备启动
	pm.mu.Lock()
	if pm.states[id] != nil {
		pm.states[id].Status = "starting"
		pm.states[id].LastError = ""
	}
	pm.mu.Unlock()

	// 启动 supervisor goroutine
	go pm.supervise(cfg)

	// 如果开启了开发模式，启动文件监听
	if cfg.DevMode {
		go pm.watch(cfg)
	}

	return nil
}

// ProcessStateWithConfig 进程状态（包含配置信息）
// 用于 API 返回完整的进程信息
type ProcessStateWithConfig struct {
	ProcessState
	Config *ProcessConfigSafe `json:"config,omitempty"`
}

// ProcessConfigSafe 安全的进程配置（敏感信息已脱敏）
type ProcessConfigSafe struct {
	ID          string            `json:"id"`
	Script      string            `json:"script,omitempty"`
	Command     string            `json:"command,omitempty"`
	Args        []string          `json:"args,omitempty"`
	Cwd         string            `json:"cwd"`
	Env         map[string]string `json:"env,omitempty"` // 敏感信息已脱敏
	Interpreter string            `json:"interpreter,omitempty"`
	MaxRetries  int               `json:"maxRetries,omitempty"`
	Backoff     string            `json:"backoff,omitempty"`
	DevMode     bool              `json:"devMode,omitempty"`
	WatchPaths  []string          `json:"watchPaths,omitempty"`
}

// GetAllStatesWithConfig 获取所有进程状态（包含配置信息，敏感信息已脱敏）
// 映射 FR-005: 系统 MUST 支持查看单个进程的详细配置和环境变量
func (pm *ProcessManager) GetAllStatesWithConfig() []ProcessStateWithConfig {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]ProcessStateWithConfig, 0, len(pm.states))

	for _, state := range pm.states {
		// 复制状态
		stateCopy := *state
		if state.Status == "running" && !state.StartTime.IsZero() {
			stateCopy.Uptime = time.Since(state.StartTime).Round(time.Second).String()
		}

		item := ProcessStateWithConfig{
			ProcessState: stateCopy,
		}

		// 查找对应的配置
		for _, cfg := range pm.configs {
			if cfg.ID == state.ID {
				item.Config = &ProcessConfigSafe{
					ID:          cfg.ID,
					Script:      cfg.Script,
					Command:     cfg.Command,
					Args:        cfg.Args,
					Cwd:         cfg.Cwd,
					Env:         MaskSensitiveEnvVars(cfg.Env),
					Interpreter: cfg.Interpreter,
					MaxRetries:  cfg.MaxRetries,
					Backoff:     cfg.Backoff,
					DevMode:     cfg.DevMode,
					WatchPaths:  cfg.WatchPaths,
				}
				break
			}
		}

		result = append(result, item)
	}

	return result
}

// GetProcessLogs 获取指定进程的日志
// 映射 FR-006: 系统 MUST 支持实时查看单个进程的日志流
func (pm *ProcessManager) GetProcessLogs(id string, lines int) ([]LogEntry, error) {
	// 检查进程是否存在
	pm.mu.RLock()
	_, exists := pm.states[id]
	buf := pm.logBuffers[id]
	pm.mu.RUnlock()

	if !exists {
		return nil, ErrProcessNotFound
	}

	if buf == nil {
		return []LogEntry{}, nil
	}

	return buf.GetLast(lines), nil
}

// getOrCreateLogBuffer 获取或创建进程的日志缓冲区
func (pm *ProcessManager) getOrCreateLogBuffer(id string) *LogBuffer {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.logBuffers[id] == nil {
		pm.logBuffers[id] = NewLogBuffer(1000) // 每个进程最多 1000 条日志
	}
	return pm.logBuffers[id]
}

// addLog 添加日志条目
func (pm *ProcessManager) addLog(id, stream, content string) {
	buf := pm.getOrCreateLogBuffer(id)
	buf.Add(LogEntry{
		Timestamp: time.Now(),
		ProcessID: id,
		Stream:    stream,
		Content:   content,
	})
}
