package apis

import (
	"encoding/json"
	"io"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindJobsApi 注册 Jobs API 路由
func bindJobsApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
	jobsGroup := rg.Group("/jobs")

	// 默认要求超级用户权限
	jobsGroup.Bind(RequireSuperuserAuth())

	// 任务入队
	jobsGroup.POST("/enqueue", jobEnqueueHandler(app))

	// 获取统计信息（放在 /:id 之前，避免路由冲突）
	jobsGroup.GET("/stats", jobStatsHandler(app))

	// 任务列表
	jobsGroup.GET("", jobListHandler(app))

	// 获取单个任务
	jobsGroup.GET("/{id}", jobGetHandler(app))

	// 重新入队
	jobsGroup.POST("/{id}/requeue", jobRequeueHandler(app))

	// 删除任务
	jobsGroup.DELETE("/{id}", jobDeleteHandler(app))
}

// ==================== 请求/响应结构 ====================

type jobEnqueueRequest struct {
	Topic      string         `json:"topic"`
	Payload    map[string]any `json:"payload"`
	RunAt      *time.Time     `json:"run_at,omitempty"`
	MaxRetries int            `json:"max_retries,omitempty"`
}

// ==================== 处理器实现 ====================

// jobEnqueueHandler 处理任务入队请求
func jobEnqueueHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		var req jobEnqueueRequest
		if err := readJSON(e, &req); err != nil {
			return e.BadRequestError("Invalid request body", err)
		}

		if req.Topic == "" {
			return e.BadRequestError("Topic is required", nil)
		}

		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		// 构建入队选项
		opts := &core.JobEnqueueOptions{}
		if req.MaxRetries > 0 {
			opts.MaxRetries = req.MaxRetries
		}

		var job *core.Job
		var err error

		if req.RunAt != nil {
			opts.RunAt = *req.RunAt
			job, err = jobs.EnqueueWithOptions(req.Topic, req.Payload, opts)
		} else if req.MaxRetries > 0 {
			job, err = jobs.EnqueueWithOptions(req.Topic, req.Payload, opts)
		} else {
			job, err = jobs.Enqueue(req.Topic, req.Payload)
		}

		if err != nil {
			if err == core.ErrJobPayloadTooLarge {
				return e.BadRequestError(err.Error(), nil)
			}
			return e.InternalServerError("Failed to enqueue job", err)
		}

		return e.JSON(200, job)
	}
}

// jobGetHandler 处理获取单个任务请求
func jobGetHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		if id == "" {
			return e.BadRequestError("Job ID is required", nil)
		}

		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		job, err := jobs.Get(id)
		if err != nil {
			if err == core.ErrJobNotFound {
				return e.NotFoundError("Job not found", nil)
			}
			return e.InternalServerError("Failed to get job", err)
		}

		return e.JSON(200, job)
	}
}

// jobListHandler 处理任务列表请求
func jobListHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		// 解析查询参数
		filter := &core.JobFilter{
			Topic:  e.Request.URL.Query().Get("topic"),
			Status: e.Request.URL.Query().Get("status"),
		}

		// 解析分页参数
		if limitStr := e.Request.URL.Query().Get("limit"); limitStr != "" {
			var limit int
			if _, err := parseIntParam(limitStr, &limit); err == nil && limit > 0 {
				filter.Limit = limit
			}
		}

		if offsetStr := e.Request.URL.Query().Get("offset"); offsetStr != "" {
			var offset int
			if _, err := parseIntParam(offsetStr, &offset); err == nil && offset >= 0 {
				filter.Offset = offset
			}
		}

		result, err := jobs.List(filter)
		if err != nil {
			return e.InternalServerError("Failed to list jobs", err)
		}

		return e.JSON(200, result)
	}
}

// jobRequeueHandler 处理重新入队请求
func jobRequeueHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		if id == "" {
			return e.BadRequestError("Job ID is required", nil)
		}

		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		job, err := jobs.Requeue(id)
		if err != nil {
			if err == core.ErrJobNotFound {
				return e.NotFoundError("Job not found", nil)
			}
			if err == core.ErrJobCannotRequeue {
				return e.BadRequestError("Job cannot be requeued (must be in 'failed' status)", nil)
			}
			return e.InternalServerError("Failed to requeue job", err)
		}

		return e.JSON(200, job)
	}
}

// jobDeleteHandler 处理删除任务请求
func jobDeleteHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		id := e.Request.PathValue("id")
		if id == "" {
			return e.BadRequestError("Job ID is required", nil)
		}

		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		err := jobs.Delete(id)
		if err != nil {
			if err == core.ErrJobNotFound {
				return e.NotFoundError("Job not found", nil)
			}
			if err == core.ErrJobCannotDelete {
				return e.BadRequestError("Job cannot be deleted (must be in 'pending' or 'failed' status)", nil)
			}
			return e.InternalServerError("Failed to delete job", err)
		}

		return e.JSON(200, map[string]any{"ok": true})
	}
}

// jobStatsHandler 处理统计请求
func jobStatsHandler(app core.App) func(e *core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		jobs := app.Jobs()
		if jobs == nil {
			return e.InternalServerError("Job store not available", nil)
		}

		stats, err := jobs.Stats()
		if err != nil {
			return e.InternalServerError("Failed to get job stats", err)
		}

		return e.JSON(200, stats)
	}
}

// parseIntParam 解析整数参数
func parseIntParam(s string, v *int) (bool, error) {
	if s == "" {
		return false, nil
	}
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}
	*v = n
	return true, nil
}

// readJSON 从请求体读取 JSON 数据
func readJSON(e *core.RequestEvent, v any) error {
	body, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return err
	}
	defer e.Request.Body.Close()

	return json.Unmarshal(body, v)
}
