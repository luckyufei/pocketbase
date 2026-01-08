// Package serverless 提供 Serverless 函数运行时的集成测试
package serverless

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/plugins/serverless/hooks"
	"github.com/pocketbase/pocketbase/plugins/serverless/hostfn"
	"github.com/pocketbase/pocketbase/plugins/serverless/loader"
	"github.com/pocketbase/pocketbase/plugins/serverless/runtime"
	"github.com/pocketbase/pocketbase/plugins/serverless/security"
	"github.com/pocketbase/pocketbase/plugins/serverless/triggers"
)

// TestIntegration_HTTPHandler 测试 HTTP Handler 完整流程
func TestIntegration_HTTPHandler(t *testing.T) {
	// 1. 创建运行时配置
	config := runtime.DefaultRuntimeConfig()
	if config.MaxMemory != 128*1024*1024 {
		t.Errorf("MaxMemory = %d, want %d", config.MaxMemory, 128*1024*1024)
	}

	// 2. 创建实例池
	pool, err := runtime.NewPool(2)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	// 3. 创建 HTTP 触发器
	triggerConfig := triggers.HTTPTriggerConfig{
		Timeout:     5 * time.Second,
		MaxBodySize: 1024 * 1024,
	}
	trigger := triggers.NewHTTPTrigger(pool, triggerConfig)

	// 4. 注册路由
	trigger.RegisterRoute("/api/pb_serverless/hello", "routes/hello.js")
	trigger.RegisterRoute("/api/pb_serverless/users/:id", "routes/users.js")

	// 5. 测试路由匹配
	file, _, ok := trigger.MatchRoute("/api/pb_serverless/hello")
	if !ok {
		t.Error("MatchRoute() should match /api/pb_serverless/hello")
	}
	if file != "routes/hello.js" {
		t.Errorf("file = %s, want routes/hello.js", file)
	}

	// 测试动态路由
	_, params, ok := trigger.MatchRoute("/api/pb_serverless/users/123")
	if !ok {
		t.Error("MatchRoute() should match /api/pb_serverless/users/123")
	}
	if params["id"] != "123" {
		t.Errorf("params[id] = %s, want 123", params["id"])
	}
}

// TestIntegration_HookRegistry 测试 Hook 注册和匹配
func TestIntegration_HookRegistry(t *testing.T) {
	registry := hooks.NewRegistry()

	// 注册多个钩子
	called := false
	registry.OnRecordBeforeCreate("users", func(e *hooks.RecordEvent) error {
		called = true
		return nil
	})

	// 测试获取 Hooks
	handlers := registry.GetHooks("users", hooks.HookTypeBeforeCreate)
	if len(handlers) != 1 {
		t.Errorf("GetHooks() returned %d handlers, want 1", len(handlers))
	}

	// 测试执行
	event := &hooks.RecordEvent{
		Record:     &hooks.Record{ID: "123"},
		Collection: "users",
	}
	err := registry.Execute("users", hooks.HookTypeBeforeCreate, event)
	if err != nil {
		t.Errorf("Execute() error: %v", err)
	}
	if !called {
		t.Error("Hook handler was not called")
	}
}

// TestIntegration_HostFunctions 测试 Host Functions 集成
func TestIntegration_HostFunctions(t *testing.T) {
	// 测试 Console
	console := hostfn.NewConsole(hostfn.ConsoleConfig{})
	console.Log("test message")
	console.Warn("warning message")
	console.Error("error message")

	// 测试 KV
	kv := hostfn.NewKVStore(nil)
	err := kv.Set("test-key", "test-value", 60)
	if err != nil {
		t.Errorf("KV.Set() error: %v", err)
	}

	value, err := kv.Get("test-key")
	if err != nil {
		t.Errorf("KV.Get() error: %v", err)
	}
	if value != "test-value" {
		t.Errorf("KV.Get() = %v, want test-value", value)
	}

	// 测试 Utils
	utils := hostfn.NewUtilService()
	uuid := utils.UUID()
	if len(uuid) != 36 {
		t.Errorf("UUID() length = %d, want 36", len(uuid))
	}

	hash := utils.Hash("test")
	if len(hash) != 64 {
		t.Errorf("Hash() length = %d, want 64", len(hash))
	}

	randStr := utils.RandomString(16)
	if len(randStr) != 16 {
		t.Errorf("RandomString(16) length = %d, want 16", len(randStr))
	}
}

// TestIntegration_Security 测试安全模块集成
func TestIntegration_Security(t *testing.T) {
	// 测试沙箱
	policy := security.DefaultPolicy()
	sandbox := security.NewSandbox(policy)

	// 测试内存检查
	if err := sandbox.CheckMemory(64 * 1024 * 1024); err != nil {
		t.Errorf("CheckMemory() error: %v", err)
	}

	// 测试指令计数
	for i := 0; i < 100; i++ {
		if err := sandbox.IncrementInstructions(1); err != nil {
			t.Errorf("IncrementInstructions() error: %v", err)
		}
	}

	// 测试网络白名单
	whitelist := security.DefaultWhitelist()
	if !whitelist.IsAllowed("api.openai.com") {
		t.Error("IsAllowed(api.openai.com) should be true")
	}

	if !whitelist.IsAllowed("localhost") {
		t.Error("IsAllowed(localhost) should be true")
	}

	// 测试配额管理
	quotaConfig := security.DefaultQuotaConfig()
	qm := security.NewQuotaManager(quotaConfig)

	release, err := qm.AcquireConcurrency()
	if err != nil {
		t.Errorf("AcquireConcurrency() error: %v", err)
	}
	release()
}

// TestIntegration_Loader 测试代码加载器
func TestIntegration_Loader(t *testing.T) {
	l := loader.NewLoader("/tmp/test")

	// 测试 JavaScript 代码解析
	code := `
		export async function GET(req) {
			return new Response("Hello World");
		}
	`

	module := &loader.Module{
		Name: "test.js",
		Code: code,
	}

	methods := module.ExportedMethods()
	if len(methods) != 1 || methods[0] != "GET" {
		t.Errorf("ExportedMethods() = %v, want [GET]", methods)
	}

	// 测试加载器基本功能
	if l == nil {
		t.Error("NewLoader() returned nil")
	}
}

// TestIntegration_CronTrigger 测试 Cron 触发器
func TestIntegration_CronTrigger(t *testing.T) {
	trigger := triggers.NewCronTrigger("test-job", "*/5 * * * *")

	if trigger.Name != "test-job" {
		t.Errorf("Name = %s, want test-job", trigger.Name)
	}

	if trigger.Schedule != "*/5 * * * *" {
		t.Errorf("Schedule = %s, want */5 * * * *", trigger.Schedule)
	}

	// 测试下次运行时间
	nextRun, err := trigger.NextRun()
	if err != nil {
		t.Errorf("NextRun() error: %v", err)
	}

	if nextRun.Before(time.Now()) {
		t.Error("NextRun() should be in the future")
	}
}

// TestIntegration_VectorSearch 测试向量搜索
func TestIntegration_VectorSearch(t *testing.T) {
	vs := hostfn.NewVectorSearch(nil)

	// 测试余弦相似度计算
	v1 := []float64{1.0, 0.0, 0.0}
	v2 := []float64{1.0, 0.0, 0.0}
	similarity := vs.CosineSimilarity(v1, v2)
	if similarity != 1.0 {
		t.Errorf("CosineSimilarity() = %f, want 1.0", similarity)
	}

	// 测试正交向量
	v3 := []float64{0.0, 1.0, 0.0}
	similarity = vs.CosineSimilarity(v1, v3)
	if similarity != 0.0 {
		t.Errorf("CosineSimilarity() = %f, want 0.0", similarity)
	}

	// 测试维度验证
	err := vs.ValidateDimensions(v1, v2)
	if err != nil {
		t.Errorf("ValidateDimensions() error: %v", err)
	}

	// 测试不同维度
	v4 := []float64{1.0, 0.0}
	err = vs.ValidateDimensions(v1, v4)
	if err == nil {
		t.Error("ValidateDimensions() should fail for different dimensions")
	}
}

// TestIntegration_Transaction 测试事务支持
func TestIntegration_Transaction(t *testing.T) {
	ctx := context.Background()
	tx := hostfn.NewTransactionManager()

	// 开始事务
	txID, err := tx.Begin(ctx)
	if err != nil {
		t.Errorf("Begin() error: %v", err)
	}

	if txID == "" {
		t.Error("Begin() returned empty txID")
	}

	// 提交事务
	if err := tx.Commit(txID); err != nil {
		t.Errorf("Commit() error: %v", err)
	}

	// 测试回滚
	txID2, _ := tx.Begin(ctx)
	if err := tx.Rollback(txID2); err != nil {
		t.Errorf("Rollback() error: %v", err)
	}
}

// TestIntegration_HTTPRequest 测试 HTTP 请求构建
func TestIntegration_HTTPRequest(t *testing.T) {
	pool, err := runtime.NewPool(1)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	trigger := triggers.NewHTTPTrigger(pool, triggers.HTTPTriggerConfig{
		Timeout:     5 * time.Second,
		MaxBodySize: 1024,
	})

	// 创建测试请求
	body := strings.NewReader(`{"name":"test"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/test?foo=bar", body)
	req.Header.Set("Content-Type", "application/json")

	jsReq, err := trigger.BuildJSRequest(req)
	if err != nil {
		t.Fatalf("BuildJSRequest() error: %v", err)
	}

	if jsReq.Method != "POST" {
		t.Errorf("Method = %s, want POST", jsReq.Method)
	}

	if jsReq.URL != "/api/test" {
		t.Errorf("URL = %s, want /api/test", jsReq.URL)
	}

	if jsReq.Headers["Content-Type"] != "application/json" {
		t.Errorf("Headers[Content-Type] = %s, want application/json", jsReq.Headers["Content-Type"])
	}

	if jsReq.Query["foo"] != "bar" {
		t.Errorf("Query[foo] = %s, want bar", jsReq.Query["foo"])
	}

	if jsReq.Body != `{"name":"test"}` {
		t.Errorf("Body = %s, want {\"name\":\"test\"}", jsReq.Body)
	}
}

// TestIntegration_EndToEnd 端到端测试
func TestIntegration_EndToEnd(t *testing.T) {
	// 模拟完整的请求处理流程

	// 1. 安全检查
	whitelist := security.DefaultWhitelist()
	if err := whitelist.ValidateURL("https://api.openai.com/v1/chat"); err != nil {
		t.Errorf("ValidateURL() error: %v", err)
	}

	// 2. 配额检查
	qm := security.NewQuotaManager(security.DefaultQuotaConfig())
	release, err := qm.AcquireConcurrency()
	if err != nil {
		t.Fatalf("AcquireConcurrency() error: %v", err)
	}
	defer release()

	// 3. 沙箱初始化
	sandbox := security.NewSandbox(security.DefaultPolicy())

	// 4. 执行代码（模拟）
	if err := sandbox.CheckMemory(32 * 1024 * 1024); err != nil {
		t.Errorf("CheckMemory() error: %v", err)
	}

	// 5. 日志记录
	console := hostfn.NewConsole(hostfn.ConsoleConfig{})
	console.Log("Request processed successfully")

	// 6. 获取统计
	stats := sandbox.GetStats()
	if stats == nil {
		t.Error("GetStats() returned nil")
	}
}

// TestIntegration_PoolStats 测试实例池统计
func TestIntegration_PoolStats(t *testing.T) {
	pool, err := runtime.NewPool(5)
	if err != nil {
		t.Fatalf("NewPool() error: %v", err)
	}
	defer pool.Close()

	if pool.Size() != 5 {
		t.Errorf("Size() = %d, want 5", pool.Size())
	}

	if pool.Available() != 5 {
		t.Errorf("Available() = %d, want 5", pool.Available())
	}

	// 获取一个实例
	engine, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatalf("Acquire() error: %v", err)
	}

	if pool.Available() != 4 {
		t.Errorf("Available() after Acquire = %d, want 4", pool.Available())
	}

	stats := pool.Stats()
	if stats.InUse != 1 {
		t.Errorf("Stats().InUse = %d, want 1", stats.InUse)
	}

	// 释放实例
	pool.Release(engine)

	if pool.Available() != 5 {
		t.Errorf("Available() after Release = %d, want 5", pool.Available())
	}
}
