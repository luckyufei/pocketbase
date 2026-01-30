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
	app     core.App
	config  Config
	configs []*ProcessConfig
	states  map[string]*ProcessState
	mu      sync.RWMutex
	ctx     context.Context
	cancel  context.CancelFunc
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
		app:    app,
		config: config,
		states: make(map[string]*ProcessState),
		ctx:    ctx,
		cancel: cancel,
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
