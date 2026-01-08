package apis

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// bindTraceApi registers the trace api endpoints.
func bindTraceApi(app core.App, rg *router.RouterGroup[*core.RequestEvent]) {
	subGroup := rg.Group("/traces")
	
	// GET /api/traces - 列表查询
	subGroup.GET("", tracesList)
	
	// GET /api/traces/stats - 统计数据
	subGroup.GET("/stats", tracesStats)
	
	// GET /api/traces/:trace_id - 获取完整调用链
	subGroup.GET("/{trace_id}", tracesGetTrace)
}

// tracesList 处理 GET /api/traces 请求
func tracesList(e *core.RequestEvent) error {
	// 检查 Superuser 权限
	if !e.HasSuperuserAuth() {
		return NewForbiddenError("Only superusers can access trace data", nil)
	}

	// 解析查询参数
	params := core.NewFilterParams()
	
	if traceID := e.Request.URL.Query().Get("trace_id"); traceID != "" {
		params.TraceID = traceID
	}
	
	if spanID := e.Request.URL.Query().Get("span_id"); spanID != "" {
		params.SpanID = spanID
	}
	
	if operation := e.Request.URL.Query().Get("operation"); operation != "" {
		params.Operation = operation
	}
	
	if status := e.Request.URL.Query().Get("status"); status != "" {
		switch strings.ToUpper(status) {
		case "OK":
			params.Status = core.SpanStatusOK
		case "ERROR":
			params.Status = core.SpanStatusError
		}
	}
	
	if startTime := e.Request.URL.Query().Get("start_time"); startTime != "" {
		if t, err := strconv.ParseInt(startTime, 10, 64); err == nil {
			params.StartTime = t
		}
	}
	
	if endTime := e.Request.URL.Query().Get("end_time"); endTime != "" {
		if t, err := strconv.ParseInt(endTime, 10, 64); err == nil {
			params.EndTime = t
		}
	}
	
	if limit := e.Request.URL.Query().Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			params.Limit = l
		}
	}
	
	if offset := e.Request.URL.Query().Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			params.Offset = o
		}
	}
	
	if rootOnly := e.Request.URL.Query().Get("root_only"); rootOnly == "true" {
		params.RootOnly = true
	}

	// 解析 attributes 过滤器
	for key, values := range e.Request.URL.Query() {
		if strings.HasPrefix(key, "attr.") {
			attrKey := strings.TrimPrefix(key, "attr.")
			if len(values) > 0 {
				params.AttributeFilters[attrKey] = values[0]
			}
		}
	}

	// 查询数据
	spans, total, err := e.App.Trace().Query(params)
	if err != nil {
		return NewBadRequestError("Failed to query traces", err)
	}

	// 返回结果
	result := map[string]any{
		"page":       (params.Offset / params.Limit) + 1,
		"perPage":    params.Limit,
		"totalItems": total,
		"totalPages": (total + int64(params.Limit) - 1) / int64(params.Limit),
		"items":      spans,
	}

	return e.JSON(http.StatusOK, result)
}

// tracesStats 处理 GET /api/traces/stats 请求
func tracesStats(e *core.RequestEvent) error {
	// 检查 Superuser 权限
	if !e.HasSuperuserAuth() {
		return NewForbiddenError("Only superusers can access trace data", nil)
	}

	// 解析查询参数
	params := core.NewFilterParams()
	
	if startTime := e.Request.URL.Query().Get("start_time"); startTime != "" {
		if t, err := strconv.ParseInt(startTime, 10, 64); err == nil {
			params.StartTime = t
		}
	}
	
	if endTime := e.Request.URL.Query().Get("end_time"); endTime != "" {
		if t, err := strconv.ParseInt(endTime, 10, 64); err == nil {
			params.EndTime = t
		}
	}

	// 只统计根 Span
	params.RootOnly = true

	// 获取统计数据
	stats, err := e.App.Trace().Stats(params)
	if err != nil {
		return NewBadRequestError("Failed to get trace stats", err)
	}

	return e.JSON(http.StatusOK, stats)
}

// tracesGetTrace 处理 GET /api/traces/:trace_id 请求
func tracesGetTrace(e *core.RequestEvent) error {
	// 检查 Superuser 权限
	if !e.HasSuperuserAuth() {
		return NewForbiddenError("Only superusers can access trace data", nil)
	}

	traceID := e.Request.PathValue("trace_id")
	if traceID == "" {
		return NewBadRequestError("Missing trace_id parameter", nil)
	}

	// 获取完整调用链
	spans, err := e.App.Trace().GetTrace(traceID)
	if err != nil {
		return NewBadRequestError("Failed to get trace", err)
	}

	if len(spans) == 0 {
		return NewNotFoundError("Trace not found", nil)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"trace_id": traceID,
		"spans":    spans,
	})
}