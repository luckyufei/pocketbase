# PocketBase 技术架构深度总结

> 本文档系统性总结 PocketBase 的核心设计模式和实现细节，供设计 Go/Python 后台服务参考。

---

## 1. 整体架构

### 1.1 核心设计理念

PocketBase 是一个 **单文件可执行** 的后端服务，核心理念：

- **嵌入式 SQLite**：无需外部数据库依赖
- **Hook 驱动**：所有操作可通过 Before/After Hook 拦截
- **接口优先**：核心 `App` 接口定义所有功能，便于测试和扩展
- **约定优于配置**：Collection 即 Schema，Rules 即权限

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer (cobra)                        │
│                     pocketbase.go                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     APIs Layer                               │
│         REST Endpoints + Middlewares + Realtime             │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Core Layer                               │
│     App Interface + Models + Hooks + Business Logic         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Tools Layer                              │
│   Router / Hook / Mailer / Filesystem / Search / Security   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│              SQLite (Concurrent + NonConcurrent)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 数据库层设计

### 2.1 双连接池架构

PocketBase 针对 SQLite 的并发限制，设计了 **双连接池** 模式：

```go
type BaseApp struct {
    concurrentDB    *dbx.DB  // 只读操作，支持并发
    nonconcurrentDB *dbx.DB  // 写操作，串行执行
    auxConcurrentDB *dbx.DB  // 辅助数据库（日志等）
}
```

**设计原因**：
- SQLite 写操作需要独占锁，并发写会导致 `SQLITE_BUSY`
- 读操作可以并发执行
- 分离读写连接池，最大化并发性能

**使用模式**：
```go
// 读操作 - 使用并发连接
app.ConcurrentDB().Select("*").From("users").All(&users)

// 写操作 - 使用非并发连接
app.NonconcurrentDB().Insert("users", data).Execute()

// 智能选择 - Save/Delete 自动使用正确连接
app.Save(record)  // 内部使用 NonconcurrentDB
```

### 2.2 Query Builder 模式

基于 `dbx` 库的链式查询构建：

```go
// 基础查询
app.RecordQuery(collection).
    AndWhere(dbx.HashExp{"status": "active"}).
    AndWhere(dbx.NewExp("age > {:age}", dbx.Params{"age": 18})).
    OrderBy("created DESC").
    Limit(10).
    All(&records)

// 带 Hook 的查询（自动处理 Record 映射）
query := app.RecordQuery(collection).WithBuildHook(func(q *dbx.Query) {
    q.WithExecHook(execLockRetry(timeout, maxRetries))
    q.WithOneHook(resolveRecordOneHook)
    q.WithAllHook(resolveRecordAllHook)
})
```

### 2.3 事务处理

```go
// 事务包装
app.RunInTransaction(func(txApp App) error {
    // txApp 是一个新的 App 实例，共享事务连接
    if err := txApp.Save(record1); err != nil {
        return err // 自动回滚
    }
    if err := txApp.Save(record2); err != nil {
        return err
    }
    return nil // 自动提交
})
```

### 2.4 锁重试机制

```go
// SQLite BUSY 错误自动重试
func execLockRetry(timeout time.Duration, maxRetries int) dbx.ExecHookFunc {
    return func(q *dbx.Query, op func() error) error {
        for i := 0; i < maxRetries; i++ {
            err := op()
            if err == nil || !isBusyError(err) {
                return err
            }
            time.Sleep(backoff(i))
        }
        return errors.New("max lock retries exceeded")
    }
}
```

---

## 3. Hook 系统设计

### 3.1 泛型 Hook 实现

```go
// 核心 Hook 结构
type Hook[T any] struct {
    handlers []*Handler[T]
    mux      sync.RWMutex
}

type Handler[T any] struct {
    Id       string
    Func     func(e T) error
    Priority int  // 数字越小优先级越高
}

// 注册 Hook
hook.Bind(&Handler[*RecordEvent]{
    Id:       "myHandler",
    Func:     func(e *RecordEvent) error { return e.Next() },
    Priority: 0,
})

// 触发 Hook
hook.Trigger(event, func(e *RecordEvent) error {
    // 最终执行的逻辑
    return nil
})
```

### 3.2 Hook 执行链

```go
// Hook 链式执行
func (h *Hook[T]) Trigger(e T, oneOffHandlers ...func(e T) error) error {
    // 1. 按优先级排序所有 handlers
    // 2. 依次执行，通过 e.Next() 传递控制权
    // 3. 任何 handler 返回 error 则中断链
}
```

### 3.3 Tagged Hook（条件过滤）

```go
// 只对特定 Collection 触发
type TaggedHook[T HookTagger] struct {
    *Hook[T]
    tags []string
}

// Record 实现 HookTagger
func (r *Record) HookTags() []string {
    return []string{r.Collection().Id, r.Collection().Name}
}

// 注册时指定 tags
app.OnRecordCreate("users").BindFunc(func(e *RecordEvent) error {
    // 只在 users collection 创建时触发
})
```

### 3.4 60+ 内置 Hook 点

```go
// 生命周期 Hooks
OnBootstrap()
OnServe()
OnTerminate()

// Model Hooks（通用）
OnModelValidate()
OnModelCreate() / OnModelCreateExecute() / OnModelAfterCreateSuccess() / OnModelAfterCreateError()
OnModelUpdate() / OnModelUpdateExecute() / OnModelAfterUpdateSuccess() / OnModelAfterUpdateError()
OnModelDelete() / OnModelDeleteExecute() / OnModelAfterDeleteSuccess() / OnModelAfterDeleteError()

// Record Hooks（特化）
OnRecordValidate()
OnRecordCreate() / OnRecordCreateExecute() / OnRecordAfterCreateSuccess()
OnRecordUpdate() / OnRecordUpdateExecute() / OnRecordAfterUpdateSuccess()
OnRecordDelete() / OnRecordDeleteExecute() / OnRecordAfterDeleteSuccess()

// API Request Hooks
OnRecordCreateRequest()
OnRecordUpdateRequest()
OnRecordDeleteRequest()
OnRecordAuthWithPasswordRequest()
OnRecordAuthWithOAuth2Request()
// ... 更多
```

---

## 4. 认证系统设计

### 4.1 Token 设计

```go
// Token 类型
const (
    TokenTypeAuth         = "auth"
    TokenTypeFile         = "file"
    TokenTypeVerification = "verification"
    TokenTypePasswordReset = "passwordReset"
    TokenTypeEmailChange  = "emailChange"
)

// Token 生成
func (record *Record) NewAuthToken() (string, error) {
    return security.NewJWT(
        jwt.MapClaims{
            TokenClaimId:           record.Id,
            TokenClaimType:         TokenTypeAuth,
            TokenClaimCollectionId: record.Collection().Id,
            TokenClaimRefreshable:  true,
        },
        record.TokenKey() + record.Collection().AuthToken.Secret,
        record.Collection().AuthToken.Duration,
    )
}
```

**关键设计**：
- Token Secret = `record.TokenKey()` + `collection.AuthToken.Secret`
- 每个用户有独立的 `TokenKey`，修改密码后自动失效所有 Token
- 不同类型 Token 使用不同 Secret，隔离安全域

### 4.2 密码处理

```go
// bcrypt 哈希
type PasswordFieldValue struct {
    Hash  string  // bcrypt hash
    Plain string  // 临时存储明文（仅验证用）
}

// 验证密码
func (record *Record) ValidatePassword(password string) bool {
    raw, _ := record.GetRaw(FieldNamePassword).(*PasswordFieldValue)
    if raw == nil || raw.Hash == "" {
        return false
    }
    return bcrypt.CompareHashAndPassword([]byte(raw.Hash), []byte(password)) == nil
}
```

### 4.3 OAuth2 实现

```go
// Provider 接口
type Provider interface {
    SetContext(ctx context.Context)
    SetRedirectURL(url string)
    FetchToken(code string, opts ...oauth2.AuthCodeOption) (*oauth2.Token, error)
    FetchAuthUser(token *oauth2.Token) (*AuthUser, error)
    PKCE() bool
}

// 内置 Provider
// Google, Facebook, GitHub, GitLab, Discord, Twitter, Microsoft, Apple, Spotify, ...

// 认证流程
1. Client 请求 OAuth2 URL
2. 用户授权后回调带 code
3. Server 用 code 换 token
4. Server 用 token 获取用户信息
5. 查找/创建 ExternalAuth 关联
6. 返回 PocketBase auth token
```

### 4.4 MFA/OTP 支持

```go
// OTP 模型
type OTP struct {
    Id        string
    RecordRef string
    Password  string  // bcrypt hash
    Created   time.Time
}

// MFA 模型
type MFA struct {
    Id        string
    RecordRef string
    Method    string  // "password", "oauth2", "otp"
    Created   time.Time
}

// 验证流程
1. 首次认证成功 → 创建 MFA 记录
2. 返回 mfaId 给客户端
3. 客户端用 mfaId + OTP 完成二次验证
4. 验证通过 → 返回 auth token
```

---

## 5. API 设计模式

### 5.1 Router 设计

```go
// 基于 http.ServeMux 的轻量封装
type Router[T hook.Resolver] struct {
    mux          *http.ServeMux
    middlewares  []*hook.Handler[T]
    eventFactory func(w http.ResponseWriter, r *http.Request) T
}

// 路由注册
router.GET("/api/collections/{collection}/records", recordsList)
router.POST("/api/collections/{collection}/records", recordCreate)
router.PATCH("/api/collections/{collection}/records/{id}", recordUpdate)
router.DELETE("/api/collections/{collection}/records/{id}", recordDelete)

// 路由组
subGroup := router.Group("/api/collections/{collection}/records")
subGroup.Bind(authMiddleware)
```

### 5.2 Middleware 链

```go
// 内置 Middleware
func NewRouter(app App) *Router {
    router := router.NewRouter(eventFactory)
    
    // 按顺序注册
    router.Bind(wwwRedirectMiddleware())     // www 重定向
    router.Bind(panicRecoveryMiddleware())   // panic 恢复
    router.Bind(activityLoggerMiddleware())  // 请求日志
    router.Bind(corsMiddleware())            // CORS
    router.Bind(gzipMiddleware())            // Gzip 压缩
    router.Bind(bodyLimitMiddleware())       // 请求体大小限制
    router.Bind(rateLimitMiddleware())       // 限流
    router.Bind(authTokenMiddleware())       // Token 解析
    router.Bind(securityHeadersMiddleware()) // 安全头
    
    return router
}
```

### 5.3 Request Event 设计

```go
type RequestEvent struct {
    App      App
    Request  *http.Request
    Response *ResponseWriter
    Auth     *Record  // 当前认证用户
    
    // 便捷方法
    JSON(status int, data any) error
    String(status int, data string) error
    Blob(status int, contentType string, data []byte) error
    NoContent(status int) error
    Redirect(status int, url string) error
    
    // 错误响应
    BadRequestError(message string, err error) *ApiError
    UnauthorizedError(message string, err error) *ApiError
    ForbiddenError(message string, err error) *ApiError
    NotFoundError(message string, err error) *ApiError
    InternalServerError(message string, err error) *ApiError
}
```

### 5.4 API Rule 设计

```go
// Collection 权限规则
type Collection struct {
    ListRule   *string  // nil = 仅 superuser
    ViewRule   *string  // "" = 公开
    CreateRule *string  // "@request.auth.id != ''" = 需登录
    UpdateRule *string  // "@request.auth.id = id" = 仅本人
    DeleteRule *string
    ManageRule *string  // 管理权限（可修改系统字段）
}

// Rule 表达式示例
"@request.auth.id != ''"                    // 需要登录
"@request.auth.verified = true"             // 需要邮箱验证
"@request.auth.id = user.id"                // 关联用户匹配
"status = 'public' || @request.auth.id = owner.id"  // 公开或所有者
"@collection.posts.author.id ?= @request.auth.id"   // 跨表查询
```

### 5.5 Filter 表达式解析

```go
// 支持的操作符
=   // 等于
!=  // 不等于
>   // 大于
>=  // 大于等于
<   // 小于
<=  // 小于等于
~   // LIKE (contains)
!~  // NOT LIKE
?=  // 任意匹配（用于数组/关系）
?!= // 任意不匹配
?~  // 任意 LIKE
?!~ // 任意 NOT LIKE

// 逻辑操作符
&&  // AND
||  // OR
()  // 分组

// 解析流程
filter := "title ~ 'hello' && status = 'active'"
expr, err := search.FilterData(filter).BuildExpr(resolver)
// 生成 SQL: WHERE title LIKE '%hello%' AND status = 'active'
```

---

## 6. Realtime 系统

### 6.1 SSE 实现

```go
// SSE 连接处理
func realtimeConnect(e *RequestEvent) error {
    // 1. 设置 SSE 响应头
    e.Response.Header().Set("Content-Type", "text/event-stream")
    e.Response.Header().Set("Cache-Control", "no-cache")
    e.Response.Header().Set("Connection", "keep-alive")
    
    // 2. 创建 Client
    client := subscriptions.NewDefaultClient()
    app.SubscriptionsBroker().Register(client)
    defer app.SubscriptionsBroker().Unregister(client)
    
    // 3. 发送消息循环
    for {
        select {
        case msg := <-client.Channel():
            fmt.Fprintf(w, "id:%s\nevent:%s\ndata:%s\n\n", msg.Id, msg.Name, msg.Data)
            w.Flush()
        case <-client.Context().Done():
            return nil
        }
    }
}
```

### 6.2 订阅管理

```go
// Broker 管理所有连接
type Broker struct {
    clients map[string]Client
    mux     sync.RWMutex
}

// Client 订阅
client.Subscribe("posts")           // 订阅整个 collection
client.Subscribe("posts/RECORD_ID") // 订阅单条记录

// 消息广播
broker.Send(Message{
    Name: "posts/RECORD_ID",
    Data: `{"action":"update","record":{...}}`,
})
```

### 6.3 权限检查

```go
// 订阅时检查权限
func canSubscribe(client Client, subscription string) bool {
    // 1. 解析订阅目标
    collection, recordId := parseSubscription(subscription)
    
    // 2. 检查 ListRule/ViewRule
    if recordId != "" {
        return checkViewRule(client.Auth(), collection, recordId)
    }
    return checkListRule(client.Auth(), collection)
}
```

---

## 7. 文件存储设计

### 7.1 存储抽象

```go
// FileSystem 接口
type System interface {
    Exists(key string) (bool, error)
    Attributes(key string) (*blob.Attributes, error)
    GetReader(key string) (*blob.Reader, error)
    Upload(content []byte, key string) error
    UploadMultipart(fh *multipart.FileHeader, key string) error
    Delete(key string) error
    DeletePrefix(prefix string) error
    Serve(w http.ResponseWriter, r *http.Request, key string, name string) error
    CreateThumb(originalKey, thumbKey, thumbSize string) error
}

// 实现
type localFilesystem struct { ... }  // 本地存储
type s3Filesystem struct { ... }     // S3 兼容存储
```

### 7.2 文件命名

```go
// 文件名生成（防碰撞）
func normalizeName(originalName string) string {
    cleanName := inflector.Snakecase(originalName)
    randomPart := security.RandomStringWithAlphabet(10, "abcdefghijklmnopqrstuvwxyz0123456789")
    return fmt.Sprintf("%s_%s%s", cleanName, randomPart, extension)
}

// 存储路径
// {collection_id}/{record_id}/{filename}
// 例: abc123/def456/document_x7k9m2n3p4.pdf
```

### 7.3 缩略图生成

```go
// 支持的格式
// WxH   - 裁剪到 WxH（居中）
// WxHt  - 裁剪到 WxH（顶部）
// WxHb  - 裁剪到 WxH（底部）
// WxHf  - 适应 WxH（不裁剪）
// 0xH   - 等比缩放到高度 H
// Wx0   - 等比缩放到宽度 W

// 缩略图路径
// {collection_id}/{record_id}/thumbs_{size}/{filename}
```

---

## 8. 搜索系统设计

### 8.1 Search Provider

```go
type Provider struct {
    fieldResolver FieldResolver
    query         *dbx.SelectQuery
    page          int
    perPage       int
    sort          []SortField
    filter        []FilterData
}

// 使用
result, err := search.NewProvider(resolver).
    Query(baseQuery).
    Page(1).
    PerPage(20).
    AddFilter("status = 'active'").
    AddSort(SortField{Name: "created", Direction: SortDesc}).
    Exec(&records)
```

### 8.2 Field Resolver

```go
// 解析字段引用
type RecordFieldResolver struct {
    app             App
    collection      *Collection
    requestInfo     *RequestInfo
    allowHiddenFields bool
}

// 解析示例
// "title"           → "collection_name"."title"
// "author.name"     → JOIN + "authors"."name"
// "@request.auth.id" → 当前用户 ID
// "@collection.posts.count" → 子查询 COUNT
```

### 8.3 分页结果

```go
type Result struct {
    Items      any `json:"items"`
    Page       int `json:"page"`
    PerPage    int `json:"perPage"`
    TotalItems int `json:"totalItems"`
    TotalPages int `json:"totalPages"`
}

// 并发执行 count 和 items 查询
errg := new(errgroup.Group)
errg.Go(countExec)
errg.Go(modelsExec)
err := errg.Wait()
```

---

## 9. 定时任务设计

### 9.1 Cron 实现

```go
type Cron struct {
    timezone *time.Location
    ticker   *time.Ticker
    jobs     []*Job
    interval time.Duration
    mux      sync.RWMutex
}

// 注册任务
cron.MustAdd("cleanup", "0 0 * * *", func() {
    // 每天 0 点执行
})

cron.MustAdd("healthCheck", "*/5 * * * *", func() {
    // 每 5 分钟执行
})
```

### 9.2 Schedule 解析

```go
// 支持的表达式
// ┌───────────── minute (0-59)
// │ ┌───────────── hour (0-23)
// │ │ ┌───────────── day of month (1-31)
// │ │ │ ┌───────────── month (1-12)
// │ │ │ │ ┌───────────── day of week (0-6)
// │ │ │ │ │
// * * * * *

// 特殊字符
// *     - 任意值
// */n   - 每 n 个单位
// n-m   - 范围
// n,m   - 列表
```

---

## 10. 验证系统设计

### 10.1 基于 ozzo-validation

```go
// 表单验证
func (form *authWithPasswordForm) validate() error {
    return validation.ValidateStruct(form,
        validation.Field(&form.Identity, 
            validation.Required, 
            validation.Length(1, 255)),
        validation.Field(&form.Password, 
            validation.Required, 
            validation.Length(1, 255)),
    )
}
```

### 10.2 Field 级验证

```go
// Field 接口
type Field interface {
    ValidateSettings(ctx context.Context, app App, collection *Collection) error
    ValidateValue(ctx context.Context, app App, record *Record) error
}

// 示例：TextField 验证
func (f *TextField) ValidateValue(ctx context.Context, app App, record *Record) error {
    val := record.GetString(f.Name)
    
    return validation.Validate(val,
        validation.When(f.Required, validation.Required),
        validation.Length(f.Min, f.Max),
        validation.When(f.Pattern != "", validation.Match(regexp.MustCompile(f.Pattern))),
    )
}
```

### 10.3 API Rule 验证

```go
// 创建记录时验证 CreateRule
if *collection.CreateRule != "" {
    resolver := NewRecordFieldResolver(app, collection, requestInfo, true)
    expr, _ := search.FilterData(*collection.CreateRule).BuildExpr(resolver)
    
    // 使用 CTE 验证（记录尚未入库）
    withFrom := fmt.Sprintf("WITH {{%s}} as (SELECT %s)", dummyTable, selectValues)
    query := app.ConcurrentDB().Select("(1)").PreFragment(withFrom).AndWhere(expr)
    
    var exists int
    if err := query.Row(&exists); err != nil || exists == 0 {
        return errors.New("create rule failure")
    }
}
```

---

## 11. 关键设计模式总结

### 11.1 接口驱动

```go
// 核心 App 接口，便于测试和扩展
type App interface {
    // 数据库
    DB() *dbx.DB
    ConcurrentDB() *dbx.DB
    NonconcurrentDB() *dbx.DB
    
    // CRUD
    Save(model Model) error
    Delete(model Model) error
    
    // 查询
    FindRecordById(collection any, id string) (*Record, error)
    FindRecordsByFilter(collection any, filter string, ...) ([]*Record, error)
    
    // Hooks
    OnRecordCreate(tags ...string) *TaggedHook[*RecordEvent]
    // ... 60+ hooks
}
```

### 11.2 事件驱动

```go
// 所有操作都通过事件传递
type RecordEvent struct {
    App     App
    Context context.Context
    Record  *Record
    // ...
}

// 链式调用
app.OnRecordCreate().Trigger(event, func(e *RecordEvent) error {
    // 前置处理
    if err := e.Next(); err != nil {
        return err
    }
    // 后置处理
    return nil
})
```

### 11.3 字段拦截器

```go
// Field 可以拦截 Record 生命周期
type RecordInterceptor interface {
    Intercept(ctx context.Context, app App, record *Record, action string, next func() error) error
}

// 示例：FileField 在保存后上传文件
func (f *FileField) Intercept(ctx context.Context, app App, record *Record, action string, next func() error) error {
    if action == InterceptorActionAfterCreate || action == InterceptorActionAfterUpdate {
        // 上传新文件
        // 删除旧文件
    }
    return next()
}
```

### 11.4 延迟执行

```go
// 事务成功后执行
func execAfterSuccessTx(enabled bool, app App, fn func() error) error {
    if !enabled {
        return fn()
    }
    
    // 如果在事务中，延迟到事务成功后执行
    if txApp, ok := app.(*TxApp); ok {
        txApp.OnAfterSuccess(fn)
        return nil
    }
    
    return fn()
}
```

---

## 12. 性能优化策略

### 12.1 Collection 缓存

```go
// 缓存 Collection 元数据
func (app *BaseApp) FindCachedCollectionByNameOrId(nameOrId string) (*Collection, error) {
    // 优先从缓存读取
    if cached := app.collectionCache.Get(nameOrId); cached != nil {
        return cached, nil
    }
    
    // 缓存未命中，查询数据库
    collection, err := app.FindCollectionByNameOrId(nameOrId)
    if err == nil {
        app.collectionCache.Set(nameOrId, collection)
    }
    return collection, err
}
```

### 12.2 并发查询

```go
// 分页时并发执行 count 和 items
errg := new(errgroup.Group)
errg.Go(func() error { return countQuery.Row(&total) })
errg.Go(func() error { return itemsQuery.All(&items) })
return errg.Wait()
```

### 12.3 时序攻击防护

```go
// 空结果时随机延迟，防止时序攻击
if len(records) == 0 && hasFilter {
    randomizedThrottle(500) // 0-500ms 随机延迟
}
```

---

## 13. 可借鉴的设计要点

| 设计点 | 说明 | 适用场景 |
|--------|------|----------|
| **双连接池** | 读写分离，最大化 SQLite 并发 | 嵌入式数据库 |
| **泛型 Hook** | 类型安全的事件系统 | 需要扩展点的系统 |
| **Rule 表达式** | 声明式权限控制 | API 权限管理 |
| **Field 拦截器** | 字段级生命周期管理 | 复杂字段类型 |
| **Token 设计** | 用户级 Secret，修改密码即失效 | 认证系统 |
| **SSE Realtime** | 轻量级实时通信 | 需要实时更新的应用 |
| **存储抽象** | 本地/S3 统一接口 | 文件存储系统 |
| **Filter 解析** | 安全的用户查询 | 用户自定义筛选 |

---

## 14. 代码组织参考

```
project/
├── cmd/                    # CLI 入口
├── core/                   # 核心业务逻辑
│   ├── app.go              # App 接口定义
│   ├── base.go             # App 实现
│   ├── record_model.go     # Record 模型
│   ├── collection_model.go # Collection 模型
│   ├── field_*.go          # 各种字段类型
│   ├── events.go           # 事件定义
│   └── db_*.go             # 数据库操作
├── apis/                   # HTTP API
│   ├── base.go             # 路由注册
│   ├── middlewares.go      # 中间件
│   ├── record_crud.go      # CRUD 接口
│   └── record_auth_*.go    # 认证接口
├── tools/                  # 工具库
│   ├── hook/               # Hook 系统
│   ├── router/             # HTTP 路由
│   ├── search/             # 搜索过滤
│   ├── security/           # 安全工具
│   ├── filesystem/         # 文件系统
│   └── cron/               # 定时任务
├── forms/                  # 表单处理
├── mails/                  # 邮件模板
├── migrations/             # 数据库迁移
└── plugins/                # 可选插件
```

---

*本文档基于 PocketBase 源码分析，版本对应 Go 1.24+。*
