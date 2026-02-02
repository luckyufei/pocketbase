// Package trace 提供可插拔的分布式追踪功能
package trace

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SpanListResponse 表示 Span 列表响应
type SpanListResponse struct {
	Items      []*Span `json:"items"`
	TotalCount int64   `json:"totalCount"`
	Page       int     `json:"page"`
	PerPage    int     `json:"perPage"`
}

// TraceAPIHandler 处理追踪相关的 HTTP API
type TraceAPIHandler struct {
	repo TraceRepository
}

// NewTraceAPIHandler 创建新的 API 处理器
func NewTraceAPIHandler(repo TraceRepository) *TraceAPIHandler {
	return &TraceAPIHandler{repo: repo}
}

// RegisterRoutes 注册追踪 API 路由
func (h *TraceAPIHandler) RegisterRoutes(mux *http.ServeMux, prefix string) {
	// 确保 prefix 不以 / 结尾
	prefix = strings.TrimSuffix(prefix, "/")

	// GET /api/_/trace/spans - 列表查询
	mux.HandleFunc(prefix+"/spans", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListSpans(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// GET/DELETE /api/_/trace/spans/{traceId} - 按 TraceID 操作
	mux.HandleFunc(prefix+"/spans/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, prefix+"/spans/")
		parts := strings.Split(path, "/")

		if len(parts) == 1 && parts[0] != "" {
			traceID := parts[0]
			switch r.Method {
			case http.MethodGet:
				h.GetSpansByTraceID(w, r, traceID)
			case http.MethodDelete:
				h.DeleteByTraceID(w, r, traceID)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else if len(parts) == 2 && parts[0] != "" && parts[1] != "" {
			traceID := parts[0]
			spanID := parts[1]
			switch r.Method {
			case http.MethodGet:
				h.GetSpan(w, r, traceID, spanID)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		} else {
			http.NotFound(w, r)
		}
	})
}

// ListSpans 处理 GET /api/_/trace/spans
func (h *TraceAPIHandler) ListSpans(w http.ResponseWriter, r *http.Request) {
	opts := parseQueryOptions(r)

	spans, err := h.repo.Query(opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to query spans", err)
		return
	}

	count, err := h.repo.Count(opts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to count spans", err)
		return
	}

	page := 1
	if opts.Offset > 0 && opts.Limit > 0 {
		page = opts.Offset/opts.Limit + 1
	}

	response := SpanListResponse{
		Items:      spans,
		TotalCount: count,
		Page:       page,
		PerPage:    opts.Limit,
	}

	writeJSON(w, http.StatusOK, response)
}

// GetSpansByTraceID 处理 GET /api/_/trace/spans/{traceId}
func (h *TraceAPIHandler) GetSpansByTraceID(w http.ResponseWriter, r *http.Request, traceID string) {
	spans, err := h.repo.FindByTraceID(traceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to find spans", err)
		return
	}

	if spans == nil {
		spans = []*Span{}
	}

	writeJSON(w, http.StatusOK, spans)
}

// GetSpan 处理 GET /api/_/trace/spans/{traceId}/{spanId}
func (h *TraceAPIHandler) GetSpan(w http.ResponseWriter, r *http.Request, traceID, spanID string) {
	span, err := h.repo.FindBySpanID(spanID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to find span", err)
		return
	}

	if span == nil {
		writeError(w, http.StatusNotFound, "Span not found", nil)
		return
	}

	writeJSON(w, http.StatusOK, span)
}

// DeleteByTraceID 处理 DELETE /api/_/trace/spans/{traceId}
func (h *TraceAPIHandler) DeleteByTraceID(w http.ResponseWriter, r *http.Request, traceID string) {
	err := h.repo.DeleteByTraceID(traceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete spans", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// parseQueryOptions 从请求参数解析查询选项
func parseQueryOptions(r *http.Request) TraceQueryOptions {
	q := r.URL.Query()

	opts := TraceQueryOptions{
		TraceID:      q.Get("traceId"),
		ParentSpanID: q.Get("parentSpanId"),
		SpanName:     q.Get("name"),
		OrderBy:      q.Get("orderBy"),
		OrderDesc:    q.Get("orderDir") != "asc",
	}

	// 解析分页
	if limit := q.Get("limit"); limit != "" {
		if l, err := strconv.Atoi(limit); err == nil && l > 0 {
			opts.Limit = l
		}
	}
	if opts.Limit <= 0 {
		opts.Limit = 20 // 默认每页 20 条
	}

	if offset := q.Get("offset"); offset != "" {
		if o, err := strconv.Atoi(offset); err == nil && o >= 0 {
			opts.Offset = o
		}
	}

	if page := q.Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil && p > 0 {
			opts.Offset = (p - 1) * opts.Limit
		}
	}

	// 解析持续时间过滤
	if minDur := q.Get("minDuration"); minDur != "" {
		if ms, err := strconv.Atoi(minDur); err == nil && ms > 0 {
			opts.MinDuration = time.Duration(ms) * time.Millisecond
		}
	}

	if maxDur := q.Get("maxDuration"); maxDur != "" {
		if ms, err := strconv.Atoi(maxDur); err == nil && ms > 0 {
			opts.MaxDuration = time.Duration(ms) * time.Millisecond
		}
	}

	// 解析状态过滤
	if status := q.Get("status"); status != "" {
		statuses := strings.Split(status, ",")
		for _, s := range statuses {
			opts.StatusFilter = append(opts.StatusFilter, SpanStatus(strings.TrimSpace(s)))
		}
	}

	// 解析时间范围
	if from := q.Get("startTimeFrom"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			opts.StartTimeFrom = t
		}
	}

	if to := q.Get("startTimeTo"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			opts.StartTimeTo = t
		}
	}

	return opts
}

// writeJSON 写入 JSON 响应
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError 写入错误响应
func writeError(w http.ResponseWriter, status int, message string, err error) {
	response := map[string]any{
		"error":   message,
		"code":    status,
	}
	if err != nil {
		response["details"] = err.Error()
	}
	writeJSON(w, status, response)
}
