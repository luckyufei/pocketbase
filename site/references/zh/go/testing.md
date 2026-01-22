# 测试

PocketBase 提供测试实用工具，帮助你为自定义代码编写测试。

## 设置测试应用

```go
package myapp_test

import (
    "testing"
    
    "github.com/pocketbase/pocketbase/tests"
)

func TestMyFeature(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // 你的测试代码
}
```

## 使用现有数据进行测试

```go
func TestWithData(t *testing.T) {
    app, err := tests.NewTestApp("./testdata")
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // 应用使用 ./testdata 中的数据初始化
}
```

## 测试 API 端点

```go
func TestAPIEndpoint(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // 创建测试请求
    req := httptest.NewRequest("GET", "/api/collections", nil)
    rec := httptest.NewRecorder()
    
    // 执行请求
    app.ServeHTTP(rec, req)
    
    // 断言响应
    if rec.Code != 200 {
        t.Errorf("Expected status 200, got %d", rec.Code)
    }
}
```

## 带认证的测试

```go
func TestAuthenticatedRequest(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // 创建测试用户
    collection, _ := app.FindCollectionByNameOrId("users")
    user := core.NewRecord(collection)
    user.Set("email", "test@example.com")
    user.SetPassword("password123")
    app.Save(user)
    
    // 生成认证令牌
    token, _ := user.NewAuthToken()
    
    // 创建已认证的请求
    req := httptest.NewRequest("GET", "/api/collections/posts/records", nil)
    req.Header.Set("Authorization", token)
    rec := httptest.NewRecorder()
    
    app.ServeHTTP(rec, req)
}
```

## 测试钩子

```go
func TestHook(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    hookCalled := false
    
    app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
        hookCalled = true
        return e.Next()
    })
    
    // 创建记录以触发钩子
    collection, _ := app.FindCollectionByNameOrId("posts")
    record := core.NewRecord(collection)
    record.Set("title", "Test")
    app.Save(record)
    
    if !hookCalled {
        t.Error("Expected hook to be called")
    }
}
```

## 最佳实践

1. **使用独立的测试数据** - 将测试数据与生产数据分开。

2. **测试后清理** - 始终调用 `app.Cleanup()` 删除临时文件。

3. **测试边缘情况** - 测试错误条件和边缘情况，而不仅仅是正常路径。

4. **使用表驱动测试** - 对于测试多个场景，使用 Go 的表驱动测试模式。

5. **模拟外部服务** - 在测试中模拟外部 API 和服务。
