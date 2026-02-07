package jobs

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// setupTestApp 创建测试用的 App 和 Router
func setupTestApp(t *testing.T) (core.App, func()) {
	t.Helper()

	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}

	// 注册 jobs 插件
	config := DefaultConfig()
	config.HTTPEnabled = true
	err = Register(app, config)
	if err != nil {
		app.Cleanup()
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	// 引导应用
	if err := app.Bootstrap(); err != nil {
		app.Cleanup()
		t.Fatalf("Failed to bootstrap app: %v", err)
	}

	cleanup := func() {
		app.Cleanup()
	}

	return app, cleanup
}

// mockRequestEvent 创建模拟的 RequestEvent
func mockRequestEvent(app core.App, method, path string, body string) *core.RequestEvent {
	var bodyReader *bytes.Reader
	if body != "" {
		bodyReader = bytes.NewReader([]byte(body))
	} else {
		bodyReader = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	return e
}

// TestParseIntParam 测试整数参数解析
func TestParseIntParam(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
		ok       bool
	}{
		{"empty string", "", 0, false},
		{"valid number", "123", 123, true},
		{"zero", "0", 0, true},
		{"large number", "999999", 999999, true},
		{"invalid chars", "12a3", 0, false},
		{"negative", "-123", 0, false},
		{"float", "12.3", 0, false},
		{"spaces", " 123", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var result int
			ok, _ := parseIntParam(tt.input, &result)

			if ok != tt.ok {
				t.Errorf("parseIntParam(%q) ok = %v, want %v", tt.input, ok, tt.ok)
			}

			if ok && result != tt.expected {
				t.Errorf("parseIntParam(%q) = %d, want %d", tt.input, result, tt.expected)
			}
		})
	}
}

// TestReadJSON 测试 JSON 读取
func TestReadJSON(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{"valid json", `{"topic":"test","payload":{}}`, false},
		{"invalid json", `{invalid}`, true},
		{"empty body", ``, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/test", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			e := &core.RequestEvent{}
			e.Request = req
			e.Response = w

			var result jobEnqueueRequest
			err := readJSON(e, &result)

			if (err != nil) != tt.wantErr {
				t.Errorf("readJSON() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// TestJobEnqueueRequest JSON 序列化
func TestJobEnqueueRequest(t *testing.T) {
	runAt := time.Now().Add(time.Hour)

	req := jobEnqueueRequest{
		Topic:      "test-topic",
		Payload:    map[string]any{"key": "value"},
		RunAt:      &runAt,
		MaxRetries: 3,
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	var parsed jobEnqueueRequest
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal request: %v", err)
	}

	if parsed.Topic != req.Topic {
		t.Errorf("Topic = %q, want %q", parsed.Topic, req.Topic)
	}

	if parsed.MaxRetries != req.MaxRetries {
		t.Errorf("MaxRetries = %d, want %d", parsed.MaxRetries, req.MaxRetries)
	}
}

// TestJobEnqueueHandlerValidation 测试入队请求验证
func TestJobEnqueueHandlerValidation(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 注册插件
	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{
			name:       "empty topic",
			body:       `{"topic":"","payload":{}}`,
			wantStatus: 400,
		},
		{
			name:       "invalid json",
			body:       `{invalid}`,
			wantStatus: 400,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			e := &core.RequestEvent{}
			e.App = app
			e.Request = req
			e.Response = w

			err := handler(e)
			if err == nil {
				t.Error("Expected error but got nil")
			}
		})
	}
}

// TestJobEnqueueHandlerSuccess 测试成功入队
func TestJobEnqueueHandlerSuccess(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 注册插件
	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(`{"topic":"test-topic","payload":{"key":"value"}}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobEnqueueHandlerWithRunAt 测试带延迟时间入队
func TestJobEnqueueHandlerWithRunAt(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	runAt := time.Now().Add(time.Hour).Format(time.RFC3339)
	body := `{"topic":"test-topic","payload":{},"run_at":"` + runAt + `"}`
	req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobEnqueueHandlerWithMaxRetries 测试带最大重试次数入队
func TestJobEnqueueHandlerWithMaxRetries(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(`{"topic":"test-topic","payload":{},"max_retries":5}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobEnqueueHandlerTopicWhitelist 测试 Topic 白名单
func TestJobEnqueueHandlerTopicWhitelist(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	config.AllowedTopics = []string{"allowed-topic"}
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	// 测试不允许的 topic
	req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(`{"topic":"not-allowed","payload":{}}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for not allowed topic")
	}

	// 测试允许的 topic
	req = httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(`{"topic":"allowed-topic","payload":{}}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	e = &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error for allowed topic: %v", err)
	}
}

// TestJobGetHandler 测试获取单个任务
func TestJobGetHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)
	job, err := store.Enqueue("test-topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("Failed to enqueue job: %v", err)
	}

	handler := jobGetHandler(app)

	// 测试存在的任务
	req := httptest.NewRequest("GET", "/api/jobs/"+job.ID, nil)
	req.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// 测试不存在的任务
	req = httptest.NewRequest("GET", "/api/jobs/nonexistent", nil)
	req.SetPathValue("id", "nonexistent")
	w = httptest.NewRecorder()

	e = &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for nonexistent job")
	}
}

// TestJobGetHandlerEmptyID 测试空 ID
func TestJobGetHandlerEmptyID(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobGetHandler(app)

	req := httptest.NewRequest("GET", "/api/jobs/", nil)
	req.SetPathValue("id", "")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for empty job ID")
	}
}

// TestJobListHandler 测试任务列表
func TestJobListHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)

	// 创建测试任务
	for i := 0; i < 5; i++ {
		_, err := store.Enqueue("test-topic", map[string]any{"index": i})
		if err != nil {
			t.Fatalf("Failed to enqueue job: %v", err)
		}
	}

	handler := jobListHandler(app)

	// 测试无过滤器
	req := httptest.NewRequest("GET", "/api/jobs", nil)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobListHandlerWithFilters 测试带过滤器的任务列表
func TestJobListHandlerWithFilters(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)

	// 创建不同 topic 的任务
	for i := 0; i < 3; i++ {
		_, err := store.Enqueue("topic-a", map[string]any{"index": i})
		if err != nil {
			t.Fatalf("Failed to enqueue job: %v", err)
		}
	}
	for i := 0; i < 2; i++ {
		_, err := store.Enqueue("topic-b", map[string]any{"index": i})
		if err != nil {
			t.Fatalf("Failed to enqueue job: %v", err)
		}
	}

	handler := jobListHandler(app)

	// 测试 topic 过滤
	req := httptest.NewRequest("GET", "/api/jobs?topic=topic-a", nil)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// 测试分页
	req = httptest.NewRequest("GET", "/api/jobs?limit=2&offset=1", nil)
	w = httptest.NewRecorder()

	e = &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobRequeueHandler 测试重新入队
func TestJobRequeueHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)
	job, err := store.Enqueue("test-topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("Failed to enqueue job: %v", err)
	}

	// 先将任务设置为失败状态
	_, err = app.DB().NewQuery("UPDATE _jobs SET status = 'failed' WHERE id = {:id}").
		Bind(map[string]any{"id": job.ID}).
		Execute()
	if err != nil {
		t.Fatalf("Failed to update job status: %v", err)
	}

	handler := jobRequeueHandler(app)

	req := httptest.NewRequest("POST", "/api/jobs/"+job.ID+"/requeue", nil)
	req.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobRequeueHandlerEmptyID 测试空 ID
func TestJobRequeueHandlerEmptyID(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobRequeueHandler(app)

	req := httptest.NewRequest("POST", "/api/jobs//requeue", nil)
	req.SetPathValue("id", "")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for empty job ID")
	}
}

// TestJobRequeueHandlerNotFound 测试重新入队不存在的任务
func TestJobRequeueHandlerNotFound(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobRequeueHandler(app)

	req := httptest.NewRequest("POST", "/api/jobs/nonexistent/requeue", nil)
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for nonexistent job")
	}
}

// TestJobRequeueHandlerCannotRequeue 测试重新入队非失败状态的任务
func TestJobRequeueHandlerCannotRequeue(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)
	job, err := store.Enqueue("test-topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("Failed to enqueue job: %v", err)
	}

	handler := jobRequeueHandler(app)

	req := httptest.NewRequest("POST", "/api/jobs/"+job.ID+"/requeue", nil)
	req.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for pending job (cannot requeue)")
	}
}

// TestJobDeleteHandler 测试删除任务
func TestJobDeleteHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)
	job, err := store.Enqueue("test-topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("Failed to enqueue job: %v", err)
	}

	handler := jobDeleteHandler(app)

	req := httptest.NewRequest("DELETE", "/api/jobs/"+job.ID, nil)
	req.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestJobDeleteHandlerEmptyID 测试空 ID
func TestJobDeleteHandlerEmptyID(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobDeleteHandler(app)

	req := httptest.NewRequest("DELETE", "/api/jobs/", nil)
	req.SetPathValue("id", "")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for empty job ID")
	}
}

// TestJobDeleteHandlerNotFound 测试删除不存在的任务
func TestJobDeleteHandlerNotFound(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobDeleteHandler(app)

	req := httptest.NewRequest("DELETE", "/api/jobs/nonexistent", nil)
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for nonexistent job")
	}
}

// TestJobDeleteHandlerCannotDelete 测试删除非 pending/failed 状态的任务
func TestJobDeleteHandlerCannotDelete(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)
	job, err := store.Enqueue("test-topic", map[string]any{"key": "value"})
	if err != nil {
		t.Fatalf("Failed to enqueue job: %v", err)
	}

	// 将任务设置为 running 状态
	_, err = app.DB().NewQuery("UPDATE _jobs SET status = 'running' WHERE id = {:id}").
		Bind(map[string]any{"id": job.ID}).
		Execute()
	if err != nil {
		t.Fatalf("Failed to update job status: %v", err)
	}

	handler := jobDeleteHandler(app)

	req := httptest.NewRequest("DELETE", "/api/jobs/"+job.ID, nil)
	req.SetPathValue("id", job.ID)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for running job (cannot delete)")
	}
}

// TestJobStatsHandler 测试统计信息
func TestJobStatsHandler(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	store := GetJobStore(app)

	// 创建一些测试任务
	for i := 0; i < 3; i++ {
		_, err := store.Enqueue("test-topic", map[string]any{"index": i})
		if err != nil {
			t.Fatalf("Failed to enqueue job: %v", err)
		}
	}

	handler := jobStatsHandler(app)

	req := httptest.NewRequest("GET", "/api/jobs/stats", nil)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// TestRegisterRoutes 测试路由注册
func TestRegisterRoutes(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	// 验证函数不会 panic - 通过 OnServe 钩子注册路由
	// 实际路由测试需要更复杂的设置
}

// TestJobEnqueueHandlerStoreNotAvailable 测试 store 不可用
func TestJobEnqueueHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件，store 将为 nil
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	config := DefaultConfig()
	handler := jobEnqueueHandler(app, config)

	req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(`{"topic":"test","payload":{}}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobGetHandlerStoreNotAvailable 测试 store 不可用
func TestJobGetHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobGetHandler(app)

	req := httptest.NewRequest("GET", "/api/jobs/test-id", nil)
	req.SetPathValue("id", "test-id")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobListHandlerStoreNotAvailable 测试 store 不可用
func TestJobListHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobListHandler(app)

	req := httptest.NewRequest("GET", "/api/jobs", nil)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobRequeueHandlerStoreNotAvailable 测试 store 不可用
func TestJobRequeueHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobRequeueHandler(app)

	req := httptest.NewRequest("POST", "/api/jobs/test-id/requeue", nil)
	req.SetPathValue("id", "test-id")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobDeleteHandlerStoreNotAvailable 测试 store 不可用
func TestJobDeleteHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobDeleteHandler(app)

	req := httptest.NewRequest("DELETE", "/api/jobs/test-id", nil)
	req.SetPathValue("id", "test-id")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobStatsHandlerStoreNotAvailable 测试 store 不可用
func TestJobStatsHandlerStoreNotAvailable(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	// 不注册插件
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobStatsHandler(app)

	req := httptest.NewRequest("GET", "/api/jobs/stats", nil)
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error when store is not available")
	}
}

// TestJobEnqueueHandlerPayloadTooLarge 测试 payload 过大
func TestJobEnqueueHandlerPayloadTooLarge(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	config.MaxPayloadSize = 100 // 设置较小的 payload 限制
	if err := Register(app, config); err != nil {
		t.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)

	// 创建一个大于限制的 payload
	largePayload := make(map[string]any)
	largePayload["data"] = strings.Repeat("x", 200)

	payloadJSON, _ := json.Marshal(map[string]any{
		"topic":   "test-topic",
		"payload": largePayload,
	})

	req := httptest.NewRequest("POST", "/api/jobs/enqueue", bytes.NewReader(payloadJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	e := &core.RequestEvent{}
	e.App = app
	e.Request = req
	e.Response = w

	err = handler(e)
	if err == nil {
		t.Error("Expected error for payload too large")
	}
}

// BenchmarkParseIntParam 基准测试
func BenchmarkParseIntParam(b *testing.B) {
	var result int
	for i := 0; i < b.N; i++ {
		parseIntParam("123456", &result)
	}
}

// BenchmarkJobEnqueueHandler 基准测试
func BenchmarkJobEnqueueHandler(b *testing.B) {
	app, err := tests.NewTestApp()
	if err != nil {
		b.Fatalf("Failed to create test app: %v", err)
	}
	defer app.Cleanup()

	config := DefaultConfig()
	if err := Register(app, config); err != nil {
		b.Fatalf("Failed to register jobs plugin: %v", err)
	}

	if err := app.Bootstrap(); err != nil {
		b.Fatalf("Failed to bootstrap: %v", err)
	}

	handler := jobEnqueueHandler(app, config)
	body := `{"topic":"test-topic","payload":{"key":"value"}}`

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/api/jobs/enqueue", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		e := &core.RequestEvent{}
		e.App = app
		e.Request = req
		e.Response = w

		handler(e)
	}
}
