package processman

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// resolveInterpreter 解析解释器路径
// User Story 3: Acceptance Scenarios
func (pm *ProcessManager) resolveInterpreter(cfg *ProcessConfig) string {
	// 1. 用户显式指定时直接使用
	if cfg.Interpreter != "" && cfg.Interpreter != "auto" {
		return cfg.Interpreter
	}

	// 2. 根据脚本类型探测
	script := cfg.Script
	if script == "" {
		return "" // 直接命令模式，无需解释器
	}

	// 3. Python 脚本探测 venv
	if strings.HasSuffix(script, ".py") {
		return pm.resolvePythonInterpreter(cfg.Cwd)
	}

	// 4. Node.js 脚本
	if strings.HasSuffix(script, ".js") || strings.HasSuffix(script, ".ts") {
		return pm.resolveNodeInterpreter(cfg.Cwd, script)
	}

	// 5. 其他类型，尝试直接执行
	return ""
}

// resolvePythonInterpreter 探测 Python 解释器
func (pm *ProcessManager) resolvePythonInterpreter(cwd string) string {
	var candidates []string

	if runtime.GOOS == "windows" {
		candidates = []string{
			filepath.Join(cwd, ".venv", "Scripts", "python.exe"),
			filepath.Join(cwd, "venv", "Scripts", "python.exe"),
		}
	} else {
		// Scenario 1: 优先 .venv
		// Scenario 2: 其次 venv
		candidates = []string{
			filepath.Join(cwd, ".venv", "bin", "python"),
			filepath.Join(cwd, "venv", "bin", "python"),
		}
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			if pm.app != nil {
				pm.app.Logger().Debug("Found Python venv", "path", path)
			}
			return path
		}
	}

	// Scenario 3: 降级到系统 Python
	if pm.app != nil {
		pm.app.Logger().Debug("No venv found, using system python3")
	}
	return "python3"
}

// resolveNodeInterpreter 探测 Node.js 解释器
func (pm *ProcessManager) resolveNodeInterpreter(cwd string, script string) string {
	// TypeScript 文件尝试使用 ts-node
	if strings.HasSuffix(script, ".ts") {
		tsNode := filepath.Join(cwd, "node_modules", ".bin", "ts-node")
		if _, err := os.Stat(tsNode); err == nil {
			return tsNode
		}
	}

	return "node"
}
