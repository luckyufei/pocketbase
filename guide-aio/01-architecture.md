# 架构概览

## 核心设计理念

PocketBase 是一个 **单文件可执行** 的后端服务：

- **双数据库支持**：SQLite（默认）/ PostgreSQL
- **Hook 驱动**：所有操作可通过 Before/After Hook 拦截
- **接口优先**：核心 `App` 接口定义所有功能，便于测试和扩展
- **约定优于配置**：Collection 即 Schema，Rules 即权限

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer (cobra)                        │
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
│     KV | Secrets | Jobs | Analytics | Trace | Gateway       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Tools Layer                              │
│   Router / Hook / Mailer / Filesystem / Search / Security   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│              SQLite / PostgreSQL (DBAdapter)                │
└─────────────────────────────────────────────────────────────┘
```

## App 接口核心方法

```go
type App interface {
    // 数据库
    DB() *dbx.DB
    ConcurrentDB() *dbx.DB
    NonconcurrentDB() *dbx.DB
    IsPostgres() bool
    
    // CRUD
    Save(model Model) error
    Delete(model Model) error
    FindRecordById(collection any, id string) (*Record, error)
    FindRecordsByFilter(collection any, filter string, ...) ([]*Record, error)
    
    // 扩展服务
    KV() KVStore
    Secrets() SecretsStore
    Jobs() JobStore
    Analytics() *Analytics
    Trace() *Trace
    ProxyManager() *ProxyManager
    
    // Hooks (60+)
    OnRecordCreate(tags ...string) *TaggedHook[*RecordEvent]
    // ...
}
```

## 核心包说明

### core/ - 核心业务逻辑

- **`app.go`**: 定义 `App` 接口 - 主要契约
- **`base.go`**: `BaseApp` 实现，管理连接池、Hook、设置
- **`events.go`**: 所有事件类型定义
- **Collection & Record Models**: 集合和记录数据模型
- **Field System** (`field_*.go`): 类型化字段实现

### apis/ - HTTP 处理层

- **`serve.go`**: Web 服务入口
- **`base.go`**: 路由注册
- **Route Handlers**: 按功能组织的处理器

### tools/ - 工具库

- **`router/`**: HTTP 路由包装
- **`hook/`**: 事件钩子系统
- **`auth/`**: OAuth2 提供者实现
- **`search/`**: 过滤表达式解析
- **`filesystem/`**: 本地/S3 存储抽象

### plugins/ - 可选扩展

- **`jsvm/`**: JavaScript VM 插件
- **`migratecmd/`**: 迁移命令
- **`ghupdate/`**: GitHub 自动更新
