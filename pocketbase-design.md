# PocketBase 架构设计与工程实践指南

本文档总结了 PocketBase 的核心架构设计和工程实践，可作为 Go 项目设计的参考模板。

## 1. 整体架构概览

PocketBase 是一个单文件可执行的后端服务，包含：
- 嵌入式 SQLite 数据库（支持实时订阅）
- 文件和用户管理
- Admin 管理界面
- REST API

### 1.1 核心设计理念

- **单一可执行文件**：所有依赖（包括前端 UI）都嵌入到 Go 二进制文件中
- **零 CGO 依赖**：使用纯 Go SQLite 驱动（modernc.org/sqlite），支持 `CGO_ENABLED=0` 构建
- **接口驱动设计**：核心功能通过 `App` 接口暴露，便于测试和扩展
- **事件驱动架构**：通过 Hook 系统实现松耦合的扩展机制

## 2. 核心接口设计模式

### 2.1 App 接口 - 门面模式

PocketBase 的核心是 `core.App` 接口，它是整个应用的门面（Facade），统一暴露所有核心功能：

```go
// core/app.go
type App interface {
    // 生命周期
    Bootstrap() error
    ResetBootstrapState() error
    IsBootstrapped() bool
    
    // 配置与状态
    DataDir() string
    IsDev() bool
    Settings() *Settings
    Store() *store.Store[string, any]
    Logger() *slog.Logger
    
    // 基础设施
    DB() dbx.Builder
    Cron() *cron.Cron
    SubscriptionsBroker() *subscriptions.Broker
    NewMailClient() mailer.Mailer
    NewFilesystem() (*filesystem.System, error)
    
    // 数据操作
    Save(model Model) error
    Delete(model Model) error
    RunInTransaction(fn func(txApp App) error) error
    
    // 查询方法
    FindRecordById(...) (*Record, error)
    FindCollectionByNameOrId(...) (*Collection, error)
    // ... 更多查询方法
    
    // 事件钩子
    OnBootstrap() *hook.Hook[*BootstrapEvent]
    OnServe() *hook.Hook[*ServeEvent]
    OnRecordCreate(tags ...string) *hook.TaggedHook[*RecordEvent]
    // ... 更多钩子
}
```

**设计要点**：
- 接口虽大但职责清晰，按功能分组
- 通过接口而非具体类型暴露功能，便于 mock 测试
- 注释明确说明"不建议用户手动实现，应使用 BaseApp"

### 2.2 BaseApp 实现 - 组合模式

```go
// core/base.go
type BaseApp struct {
    config              *BaseAppConfig
    store               *store.Store[string, any]
    cron                *cron.Cron
    settings            *Settings
    subscriptionsBroker *subscriptions.Broker
    logger              *slog.Logger
    
    // 双数据库连接池
    concurrentDB        dbx.Builder
    nonconcurrentDB     dbx.Builder
    auxConcurrentDB     dbx.Builder
    auxNonconcurrentDB  dbx.Builder
    
    // 事件钩子（按功能分组）
    onBootstrap     *hook.Hook[*BootstrapEvent]
    onServe         *hook.Hook[*ServeEvent]
    // ... 更多钩子
}
```

**设计要点**：
- 使用组合而非继承
- 字段按功能分组，便于维护
- 私有字段 + 公开方法，控制访问

## 3. 事件/钩子系统设计

### 3.1 Hook 泛型实现

```go
// tools/hook/hook.go
type Handler[T Resolver] struct {
    Func     func(T) error
    Id       string
    Priority int
}

type Hook[T Resolver] struct {
    handlers []*Handler[T]
    mu       sync.RWMutex
}

func (h *Hook[T]) Bind(handler *Handler[T]) string
func (h *Hook[T]) Unbind(idsToRemove ...string)
func (h *Hook[T]) Trigger(event T, oneOffHandlerFuncs ...func(T) error) error
```

**设计要点**：
- 使用 Go 1.18+ 泛型，类型安全
- Handler 支持 Id（用于替换/移除）和 Priority（控制执行顺序）
- 线程安全（sync.RWMutex）

### 3.2 责任链模式

钩子系统采用责任链模式，处理器必须调用 `e.Next()` 才能继续链式执行：

```go
// 使用示例
app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
    // 前置处理
    e.Record.Set("slug", generateSlug(e.Record.GetString("title")))
    
    if err := e.Next(); err != nil {
        return err  // 链中后续处理器失败
    }
    
    // 后置处理（记录已保存）
    notifySubscribers(e.Record)
    return nil
})
```

**设计要点**：
- 显式调用 `Next()` 让开发者完全控制执行流程
- 支持前置/后置处理
- 可通过不调用 `Next()` 来短路执行

### 3.3 TaggedHook - 选择性触发

```go
// tools/hook/tagged.go
type TaggedHook[T Resolver] struct {
    mainHook *Hook[T]
    tags     []string
}

// 使用：只监听特定集合的事件
app.OnRecordCreate("users", "posts").BindFunc(...)
```

**设计要点**：
- 通过标签过滤事件，避免不必要的处理器执行
- 标签可以是集合名称、ID 等

### 3.4 事件类型设计

```go
// core/events.go
type RecordEvent struct {
    hook.Event
    App     App
    Record  *Record
    Context context.Context
    Type    string  // "create", "update", "delete", "validate"
}

// 基础事件嵌入
type Event struct {
    next func() error
}

func (e *Event) Next() error {
    if e.next != nil {
        return e.next()
    }
    return nil
}
```

**设计要点**：
- 事件携带完整上下文（App、Record、Context）
- 通过嵌入 `hook.Event` 获得 `Next()` 方法
- Type 字段区分操作类型

## 4. 数据库连接池策略

### 4.1 双连接池设计

PocketBase 为每个数据库维护两个连接池以最小化 SQLite BUSY 错误：

```go
// core/base.go
type BaseApp struct {
    // 主数据库
    concurrentDB    dbx.Builder  // 用于 SELECT（多连接）
    nonconcurrentDB dbx.Builder  // 用于 INSERT/UPDATE/DELETE（单连接）
    
    // 辅助数据库（日志等）
    auxConcurrentDB    dbx.Builder
    auxNonconcurrentDB dbx.Builder
}

// 智能路由
func (app *BaseApp) DB() dbx.Builder {
    if app.concurrentDB == app.nonconcurrentDB {
        return app.concurrentDB  // 事务中
    }
    return &dualDBBuilder{
        concurrentDB:    app.concurrentDB,
        nonconcurrentDB: app.nonconcurrentDB,
    }
}
```

**设计要点**：
- 读操作使用并发池（多连接），写操作使用非并发池（单连接）
- `DB()` 方法自动路由，用户无需关心细节
- 事务中两个池指向同一个 TX 实例

### 4.2 连接池配置

```go
const (
    DefaultDataMaxOpenConns int = 120  // 读连接池最大连接数
    DefaultDataMaxIdleConns int = 15   // 读连接池最大空闲连接数
    DefaultAuxMaxOpenConns  int = 20   // 辅助库最大连接数
    DefaultAuxMaxIdleConns  int = 3
    DefaultQueryTimeout     time.Duration = 30 * time.Second
)
```

## 5. Model 系统设计

### 5.1 Model 接口

```go
// core/db_model.go
type Model interface {
    TableName() string
    PK() any
    LastSavedPK() any
    IsNew() bool
    MarkAsNew()
    MarkAsNotNew()
}
```

### 5.2 Collection 与 Record 关系

```go
// Collection 定义数据结构（Schema）
type Collection struct {
    baseCollection
    collectionAuthOptions  // 认证集合特有选项
    collectionViewOptions  // 视图集合特有选项
}

// Record 是实际数据
type Record struct {
    collection       *Collection
    originalData     map[string]any  // 原始数据（用于变更检测）
    data             *store.Store[string, any]  // 当前数据
    expand           *store.Store[string, any]  // 关联展开数据
    customVisibility *store.Store[string, bool] // 字段可见性控制
    BaseModel
}
```

**设计要点**：
- Collection 是 Schema，Record 是数据
- Record 保存原始数据用于变更检测和脏检查
- 支持动态字段可见性控制

### 5.3 字段系统 - 策略模式

```go
// core/field.go
type Field interface {
    GetId() string
    SetId(id string)
    GetName() string
    SetName(name string)
    GetSystem() bool
    SetSystem(system bool)
    GetHidden() bool
    SetHidden(hidden bool)
    Type() string
    
    // 核心方法
    PrepareValue(record *Record, raw any) (any, error)
    ValidateValue(ctx context.Context, app App, record *Record) error
}

// 具体字段类型实现
type TextField struct { ... }
type NumberField struct { ... }
type RelationField struct { ... }
type FileField struct { ... }
// ... 更多字段类型
```

**设计要点**：
- 每种字段类型实现 Field 接口
- `PrepareValue` 负责类型转换和规范化
- `ValidateValue` 负责业务验证

## 6. HTTP 路由设计

### 6.1 泛型路由器

```go
// tools/router/router.go
type Router[T hook.Resolver] struct {
    *RouterGroup[T]
    eventFactory EventFactoryFunc[T]
}

type EventFactoryFunc[T hook.Resolver] func(w http.ResponseWriter, r *http.Request) (T, EventCleanupFunc)
```

**设计要点**：
- 基于标准库 `http.ServeMux` 的薄封装
- 泛型设计，事件类型可定制
- 支持路由分组和中间件

### 6.2 中间件设计

```go
// apis/middlewares.go
func RequireAuth() func(*core.RequestEvent) error {
    return func(e *core.RequestEvent) error {
        if e.Auth == nil {
            return NewUnauthorizedError("", nil)
        }
        return e.Next()
    }
}

// 使用
router.GET("/api/protected", handler).Bind(RequireAuth())
```

## 7. 工具包设计

### 7.1 并发安全 Store

```go
// tools/store/store.go
type Store[K comparable, T any] struct {
    data    map[K]T
    mu      sync.RWMutex
    deleted int64  // 用于触发 map 收缩
}

func (s *Store[K, T]) Get(key K) T
func (s *Store[K, T]) Set(key K, value T)
func (s *Store[K, T]) Remove(key K)
func (s *Store[K, T]) GetOrSet(key K, setFunc func() T) T
```

**设计要点**：
- 泛型实现，类型安全
- 读写锁保证并发安全
- 自动收缩机制（删除超过阈值时重建 map）

### 7.2 Cron 调度器

```go
// tools/cron/cron.go
type Cron struct {
    jobs    map[string]*Job
    ticker  *time.Ticker
    // ...
}

func (c *Cron) Add(id string, schedule string, fn func())
func (c *Cron) Remove(id string)
func (c *Cron) Start()
func (c *Cron) Stop()
```

### 7.3 文件系统抽象

```go
// tools/filesystem/filesystem.go
type System struct {
    // 支持本地和 S3
}

func NewLocal(dirPath string) (*System, error)
func NewS3(bucket, region, endpoint, accessKey, secret string, forcePathStyle bool) (*System, error)
```

## 8. 插件系统设计

### 8.1 插件注册模式

```go
// plugins/jsvm/jsvm.go
func MustRegister(app core.App, config Config) {
    if err := Register(app, config); err != nil {
        panic(err)
    }
}

func Register(app core.App, config Config) error {
    // 注册钩子
    app.OnBootstrap().Bind(&hook.Handler[*core.BootstrapEvent]{
        Id:   "jsvm",
        Func: func(e *core.BootstrapEvent) error { ... },
    })
    // ...
}
```

**设计要点**：
- 插件通过钩子系统集成
- 提供 `MustRegister` 和 `Register` 两种方式
- 使用唯一 Id 避免重复注册

### 8.2 JSVM 插件 - 运行时池

```go
// plugins/jsvm/pool.go
type pool struct {
    vms chan *goja.Runtime
}

func newPool(size int, initFn func(*goja.Runtime)) *pool
func (p *pool) Get() *goja.Runtime
func (p *pool) Put(vm *goja.Runtime)
```

**设计要点**：
- 预热的 Goja 运行时池
- 避免每次请求创建新运行时的开销

## 9. 错误处理模式

### 9.1 API 错误

```go
// tools/router/error.go
type ApiError struct {
    Status  int
    Message string
    Data    map[string]any
}

func NewBadRequestError(message string, data any) *ApiError
func NewUnauthorizedError(message string, data any) *ApiError
func NewNotFoundError(message string, data any) *ApiError
```

### 9.2 验证错误

```go
// 使用 ozzo-validation
import validation "github.com/go-ozzo/ozzo-validation/v4"

func (f *TextField) ValidateValue(ctx context.Context, app App, record *Record) error {
    val := record.GetString(f.Name)
    return validation.Validate(val,
        validation.Length(f.Min, f.Max),
        validation.Match(regexp.MustCompile(f.Pattern)),
    )
}
```

## 10. 测试模式

### 10.1 测试应用实例

```go
// 创建测试用 App
func setupTestApp(t *testing.T) *tests.TestApp {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    t.Cleanup(func() {
        app.Cleanup()
    })
    return app
}
```

### 10.2 API 测试

```go
func TestRecordCreate(t *testing.T) {
    app := setupTestApp(t)
    
    scenarios := []tests.ApiScenario{
        {
            Name:   "valid create",
            Method: http.MethodPost,
            URL:    "/api/collections/posts/records",
            Body:   strings.NewReader(`{"title":"test"}`),
            ExpectedStatus: 200,
            ExpectedContent: []string{`"title":"test"`},
        },
        // ... 更多场景
    }
    
    for _, s := range scenarios {
        t.Run(s.Name, func(t *testing.T) {
            s.Test(t, app)
        })
    }
}
```

## 11. 项目结构最佳实践

```
pocketbase/
├── core/           # 核心业务逻辑（App、Model、Field、Events）
├── apis/           # HTTP 处理器和中间件
├── tools/          # 独立工具包（可复用）
│   ├── auth/       # OAuth2 提供商
│   ├── cron/       # 定时任务
│   ├── filesystem/ # 文件系统抽象
│   ├── hook/       # 事件钩子
│   ├── mailer/     # 邮件发送
│   ├── router/     # HTTP 路由
│   ├── search/     # 搜索/过滤
│   ├── security/   # 加密工具
│   ├── store/      # 并发安全存储
│   └── types/      # 自定义类型
├── plugins/        # 可选插件
├── forms/          # 表单验证（可选）
├── mails/          # 邮件模板
├── migrations/     # 数据库迁移
├── ui/             # 前端（Svelte）
├── cmd/            # CLI 命令
├── examples/       # 示例代码
└── tests/          # 测试数据
```

## 12. 关键设计原则总结

1. **接口优先**：核心功能通过接口暴露，实现可替换
2. **组合优于继承**：使用结构体嵌入而非继承
3. **显式优于隐式**：钩子需要显式调用 `Next()`
4. **泛型提升类型安全**：Hook、Store、Router 都使用泛型
5. **并发安全**：所有共享状态使用适当的同步机制
6. **工具包独立**：`tools/` 下的包可独立使用
7. **配置可选**：使用 Config 结构体 + 默认值
8. **错误处理一致**：统一的 ApiError 类型
9. **测试友好**：接口设计便于 mock
10. **单一职责**：每个包/文件职责明确
