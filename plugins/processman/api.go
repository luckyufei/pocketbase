package processman

import (
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// registerRoutes 注册 REST API 路由
func (pm *ProcessManager) registerRoutes(e *core.ServeEvent) {
	// GET /api/pm/list - 需要 superuser 权限
	e.Router.GET("/api/pm/list", func(re *core.RequestEvent) error {
		return pm.handleList(re)
	}).Bind(apis.RequireSuperuserAuth())

	// POST /api/pm/{id}/restart - 需要 superuser 权限
	e.Router.POST("/api/pm/{id}/restart", func(re *core.RequestEvent) error {
		return pm.handleRestart(re)
	}).Bind(apis.RequireSuperuserAuth())

	// POST /api/pm/{id}/stop - 需要 superuser 权限
	e.Router.POST("/api/pm/{id}/stop", func(re *core.RequestEvent) error {
		return pm.handleStop(re)
	}).Bind(apis.RequireSuperuserAuth())

	// POST /api/pm/{id}/start - 需要 superuser 权限
	// 映射 FR-003: 启动已停止的进程
	e.Router.POST("/api/pm/{id}/start", func(re *core.RequestEvent) error {
		return pm.handleStart(re)
	}).Bind(apis.RequireSuperuserAuth())

	// GET /api/pm/{id}/logs - 需要 superuser 权限
	// 映射 FR-006: 获取进程日志
	e.Router.GET("/api/pm/{id}/logs", func(re *core.RequestEvent) error {
		return pm.handleLogs(re)
	}).Bind(apis.RequireSuperuserAuth())
}

// handleList 获取所有进程状态（包含配置信息）
// User Story 6: Scenario 1
// User Story 5: 返回配置信息（敏感信息已脱敏）
func (pm *ProcessManager) handleList(e *core.RequestEvent) error {
	result := pm.GetAllStatesWithConfig()
	return e.JSON(http.StatusOK, result)
}

// handleRestart 重启指定进程
// User Story 6: Scenario 2, 3
func (pm *ProcessManager) handleRestart(e *core.RequestEvent) error {
	id := e.Request.PathValue("id")

	pm.mu.RLock()
	_, exists := pm.states[id]
	pm.mu.RUnlock()

	// Scenario 3: 进程 ID 不存在返回 404
	if !exists {
		return apis.NewNotFoundError("Process not found", nil)
	}

	// Scenario 2: 重启进程
	if err := pm.Restart(id); err != nil {
		return apis.NewBadRequestError("Failed to restart process", err)
	}

	return e.JSON(http.StatusOK, map[string]string{
		"message": "Process restart initiated",
		"id":      id,
	})
}

// handleStop 停止指定进程
func (pm *ProcessManager) handleStop(e *core.RequestEvent) error {
	id := e.Request.PathValue("id")

	pm.mu.RLock()
	_, exists := pm.states[id]
	pm.mu.RUnlock()

	if !exists {
		return apis.NewNotFoundError("Process not found", nil)
	}

	// 标记为 stopped，supervisor 循环会检测并退出
	pm.mu.Lock()
	pm.states[id].Status = "stopped"
	pm.mu.Unlock()

	if err := pm.killProcess(id); err != nil {
		return apis.NewBadRequestError("Failed to stop process", err)
	}

	return e.JSON(http.StatusOK, map[string]string{
		"message": "Process stopped",
		"id":      id,
	})
}

// handleStart 启动已停止的进程
// 映射 FR-003: 系统 MUST 支持对单个进程执行: 启动、停止、重启操作
func (pm *ProcessManager) handleStart(e *core.RequestEvent) error {
	id := e.Request.PathValue("id")

	err := pm.StartProcess(id)
	if err != nil {
		if err == ErrProcessNotFound {
			return apis.NewNotFoundError("Process not found", nil)
		}
		if err == ErrProcessAlreadyRunning {
			return apis.NewBadRequestError("Process is already running", nil)
		}
		return apis.NewBadRequestError("Failed to start process", err)
	}

	return e.JSON(http.StatusOK, map[string]string{
		"message": "Process start initiated",
		"id":      id,
	})
}

// handleLogs 获取进程日志
// 映射 FR-006: 系统 MUST 支持实时查看单个进程的日志流
func (pm *ProcessManager) handleLogs(e *core.RequestEvent) error {
	id := e.Request.PathValue("id")

	// 解析 lines 参数，默认 100
	lines := 100
	if linesStr := e.Request.URL.Query().Get("lines"); linesStr != "" {
		if n, err := strconv.Atoi(linesStr); err == nil && n > 0 {
			lines = n
			if lines > 1000 {
				lines = 1000 // 最大 1000 条
			}
		}
	}

	logs, err := pm.GetProcessLogs(id, lines)
	if err != nil {
		if err == ErrProcessNotFound {
			return apis.NewNotFoundError("Process not found", nil)
		}
		return apis.NewBadRequestError("Failed to get logs", err)
	}

	return e.JSON(http.StatusOK, logs)
}
