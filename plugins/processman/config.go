// Package processman 提供 PocketBase 的进程管理插件
// 支持启动、监控和管理 Sidecar 进程（如 Python AI Agent）
package processman

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// ProcessConfig 对应 pb_processes.json 中的单个进程配置
// 映射 spec.md Key Entities: ProcessConfig
type ProcessConfig struct {
	// 基础配置
	ID      string   `json:"id"`                // 唯一标识（必填）
	Script  string   `json:"script,omitempty"`  // Python/JS 脚本路径
	Command string   `json:"command,omitempty"` // 直接命令（与 Script 二选一）
	Args    []string `json:"args,omitempty"`    // 命令参数
	Cwd     string   `json:"cwd"`               // 工作目录（必填）

	// 环境配置 - 映射 FR-011
	Env         map[string]string `json:"env,omitempty"`
	Interpreter string            `json:"interpreter,omitempty"` // "auto" | 具体路径

	// 韧性配置 - 映射 FR-004, FR-005
	MaxRetries int    `json:"maxRetries,omitempty"` // -1 表示无限重试
	Backoff    string `json:"backoff,omitempty"`    // 解析为 time.Duration

	// 开发模式 - 映射 FR-008
	DevMode    bool     `json:"devMode,omitempty"`
	WatchPaths []string `json:"watchPaths,omitempty"`
}

// ProcessState 运行时进程状态
// 映射 spec.md Key Entities: ProcessState
type ProcessState struct {
	ID           string    `json:"id"`
	PID          int       `json:"pid"`
	Status       string    `json:"status"`       // running | stopped | crashed | starting
	StartTime    time.Time `json:"startTime"`
	Uptime       string    `json:"uptime"`       // 人类可读格式
	RestartCount int       `json:"restartCount"`
	LastError    string    `json:"lastError,omitempty"`
}

// Config 插件级配置
type Config struct {
	ConfigFile string // 配置文件路径，默认 "pb_processes.json"
}

// loadConfig 加载配置文件
// User Story 5: Acceptance Scenarios
func (pm *ProcessManager) loadConfig() error {
	configPath := pm.config.ConfigFile

	// Scenario 2: 配置文件不存在时正常返回
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		if pm.app != nil {
			pm.app.Logger().Info("No process config file found", "path", configPath)
		}
		return nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}

	// Scenario 3: JSON 格式错误时记录日志但不阻止启动
	var configs []*ProcessConfig
	if err := json.Unmarshal(data, &configs); err != nil {
		if pm.app != nil {
			pm.app.Logger().Error("Invalid process config format",
				"path", configPath,
				"error", err)
		}
		return err // 返回错误但调用方会捕获并继续
	}

	// 验证必填字段
	for _, cfg := range configs {
		if cfg.ID == "" {
			if pm.app != nil {
				pm.app.Logger().Warn("Process config missing ID, skipping")
			}
			continue
		}
		if cfg.Cwd == "" {
			cfg.Cwd = "." // 默认当前目录
		}
		if cfg.Script == "" && cfg.Command == "" {
			if pm.app != nil {
				pm.app.Logger().Warn("Process config missing script/command", "id", cfg.ID)
			}
			continue
		}

		// 解析相对路径
		if pm.app != nil && !filepath.IsAbs(cfg.Cwd) {
			cfg.Cwd = filepath.Join(pm.app.DataDir(), cfg.Cwd)
		}

		// 应用全局 DevMode（复用 app.IsDev()）
		if pm.app != nil && pm.app.IsDev() && !cfg.DevMode {
			cfg.DevMode = true
		}

		pm.configs = append(pm.configs, cfg)
	}

	if pm.app != nil {
		pm.app.Logger().Info("Loaded process configs", "count", len(pm.configs))
	}
	return nil
}
