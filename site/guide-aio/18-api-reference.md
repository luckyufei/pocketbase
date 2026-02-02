# API 速查表

## 核心 API

| 前缀 | 描述 |
|------|------|
| `/api/collections/{collection}/records` | Records CRUD |
| `/api/collections/{collection}/auth-*` | 认证相关 |
| `/api/files/{collection}/{record}/{filename}` | 文件访问 |
| `/api/realtime` | SSE 实时订阅 |

## 扩展 API

| 前缀 | 描述 | 权限 |
|------|------|------|
| `/api/kv/*` | KV 存储 | Superuser |
| `/api/secrets/*` | Secrets 管理 | Superuser |
| `/api/jobs/*` | Job Queue | Superuser |
| `/api/analytics/*` | Analytics | Superuser（events 除外） |
| `/api/traces/*` | Trace 查询 | Superuser |
| `/-/*` | Gateway 代理 | 按配置 |

## App 方法速查

```go
// 数据库
app.DB()                    // 默认连接
app.ConcurrentDB()          // 并发读连接
app.NonconcurrentDB()       // 串行写连接
app.IsPostgres()            // 是否 PostgreSQL
app.RunInTransaction(fn)    // 事务

// CRUD
app.Save(model)
app.Delete(model)
app.FindRecordById(collection, id)
app.FindFirstRecordByData(collection, field, value)
app.FindFirstRecordByFilter(collection, filter)
app.FindRecordsByFilter(collection, filter, sort, limit, offset)
app.FindCollectionByNameOrId(nameOrId)

// 扩展服务
app.KV()                    // KV 存储
app.Secrets()               // Secrets 管理
app.Jobs()                  // Job Queue
app.Analytics()             // Analytics
app.Trace()                 // 分布式追踪
app.ProxyManager()          // Gateway

// 工具
app.Cron()                  // 定时任务
app.NewMailClient()         // 邮件客户端
app.NewFilesystem()         // 文件系统
app.Logger()                // 日志
app.Settings()              // 系统设置
```

## Records API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/collections/{collection}/records` | 列表 |
| GET | `/api/collections/{collection}/records/{id}` | 获取 |
| POST | `/api/collections/{collection}/records` | 创建 |
| PATCH | `/api/collections/{collection}/records/{id}` | 更新 |
| DELETE | `/api/collections/{collection}/records/{id}` | 删除 |

## Auth API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/collections/{collection}/auth-methods` | 认证方式 |
| POST | `/api/collections/{collection}/auth-with-password` | 密码登录 |
| POST | `/api/collections/{collection}/auth-with-oauth2` | OAuth2 登录 |
| POST | `/api/collections/{collection}/auth-refresh` | 刷新 Token |
| POST | `/api/collections/{collection}/request-otp` | 请求 OTP |
| POST | `/api/collections/{collection}/auth-with-otp` | OTP 登录 |
| POST | `/api/collections/{collection}/request-verification` | 请求验证 |
| POST | `/api/collections/{collection}/confirm-verification` | 确认验证 |
| POST | `/api/collections/{collection}/request-password-reset` | 请求重置密码 |
| POST | `/api/collections/{collection}/confirm-password-reset` | 确认重置密码 |

## 查询参数

| 参数 | 描述 | 示例 |
|------|------|------|
| `filter` | 过滤条件 | `status="active"` |
| `sort` | 排序 | `-created,title` |
| `expand` | 展开关系 | `author,comments` |
| `fields` | 返回字段 | `id,title,author` |
| `page` | 页码 | `1` |
| `perPage` | 每页数量 | `20` |
| `skipTotal` | 跳过总数计算 | `true` |

## 常用 Hook

```go
// 生命周期
app.OnBootstrap()
app.OnServe()
app.OnTerminate()

// Record 操作
app.OnRecordCreate(tags...)
app.OnRecordUpdate(tags...)
app.OnRecordDelete(tags...)
app.OnRecordValidate(tags...)
app.OnRecordEnrich(tags...)

// API 请求
app.OnRecordCreateRequest(tags...)
app.OnRecordUpdateRequest(tags...)
app.OnRecordDeleteRequest(tags...)
app.OnRecordAuthWithPasswordRequest(tags...)
```
