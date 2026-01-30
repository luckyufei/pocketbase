package processman

import (
	"net/http"
	"time"

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
}

// handleList 获取所有进程状态
// User Story 6: Scenario 1
func (pm *ProcessManager) handleList(e *core.RequestEvent) error {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]ProcessState, 0, len(pm.states))
	for _, state := range pm.states {
		// 计算人类可读的 uptime
		stateCopy := *state
		if state.Status == "running" && !state.StartTime.IsZero() {
			stateCopy.Uptime = time.Since(state.StartTime).Round(time.Second).String()
		}
		result = append(result, stateCopy)
	}

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
