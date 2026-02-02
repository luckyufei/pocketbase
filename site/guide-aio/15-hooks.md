# Hook 系统

## 泛型 Hook 实现

```go
type Hook[T any] struct {
    handlers []*Handler[T]
}

type Handler[T any] struct {
    Id       string
    Func     func(e T) error
    Priority int  // 数字越小优先级越高
}

// 注册
hook.Bind(&Handler[*RecordEvent]{
    Id:       "myHandler",
    Func:     func(e *RecordEvent) error { return e.Next() },
    Priority: 0,
})

// 触发
hook.Trigger(event, func(e *RecordEvent) error {
    return nil
})
```

## Tagged Hook（条件过滤）

```go
// 只对特定 Collection 触发
app.OnRecordCreate("users").BindFunc(func(e *RecordEvent) error {
    // 只在 users collection 创建时触发
    return e.Next()
})

// 多个 Collection
app.OnRecordCreate("users", "posts").BindFunc(func(e *RecordEvent) error {
    return e.Next()
})
```

## 常用 Hook 点

### 生命周期 Hooks

```go
OnBootstrap()      // 应用启动
OnServe()          // HTTP 服务启动
OnTerminate()      // 应用终止
```

### Model Hooks

```go
OnModelValidate()
OnModelCreate() / OnModelAfterCreateSuccess()
OnModelUpdate() / OnModelAfterUpdateSuccess()
OnModelDelete() / OnModelAfterDeleteSuccess()
```

### Record Hooks

```go
OnRecordValidate()
OnRecordCreate() / OnRecordAfterCreateSuccess()
OnRecordUpdate() / OnRecordAfterUpdateSuccess()
OnRecordDelete() / OnRecordAfterDeleteSuccess()
OnRecordEnrich()  // 记录返回前增强
```

### API Request Hooks

```go
OnRecordCreateRequest()
OnRecordUpdateRequest()
OnRecordDeleteRequest()
OnRecordAuthWithPasswordRequest()
OnRecordAuthWithOAuth2Request()
OnRecordAuthRefreshRequest()
```

## Hook 执行模式

```go
app.OnRecordCreate("posts").BindFunc(func(e *RecordEvent) error {
    // 前置处理
    e.Record.Set("status", "pending")
    
    // 调用下一个 handler
    if err := e.Next(); err != nil {
        return err
    }
    
    // 后置处理（记录已保存）
    log.Println("Record created:", e.Record.Id)
    
    return nil
})
```

## 解绑 Hook

```go
// 通过 ID 解绑
app.OnRecordCreate().Unbind("myHandler")

// 解绑所有
app.OnRecordCreate().UnbindAll()
```

## 优先级

```go
app.OnRecordCreate().Bind(&Handler{
    Id:       "first",
    Priority: -10,  // 先执行
    Func:     handler1,
})

app.OnRecordCreate().Bind(&Handler{
    Id:       "last",
    Priority: 10,   // 后执行
    Func:     handler2,
})
```
