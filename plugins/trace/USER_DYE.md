# 用户染色功能使用文档

> **用户染色（User Dye）** 是一种针对特定用户进行全量追踪的功能，用于问题诊断和调试。

## 概述

在分布式系统中，当用户反馈问题时，我们需要追踪该用户的所有请求来定位问题。用户染色功能允许运维人员临时标记特定用户，使其所有请求都被完整记录，无论全局采样率设置如何。

### 核心特性

- ✅ **临时性**：染色有 TTL（生存时间），自动过期
- ✅ **优先级最高**：染色用户绕过所有其他过滤器
- ✅ **零侵入**：不需要修改用户代码
- ✅ **数量限制**：防止滥用导致存储爆炸
- ✅ **多种管理方式**：支持 API、环境变量、代码三种方式

## 快速开始

### 1. 通过代码添加染色用户

```go
import (
    "time"
    "github.com/pocketbase/pocketbase/plugins/trace"
)

// 获取 Tracer 实例
tracer := trace.GetTracer(app)

// 添加染色用户，1小时后自动过期
err := trace.DyeUser(tracer, "user123", time.Hour)
if err != nil {
    log.Printf("添加染色用户失败: %v", err)
}

// 添加染色用户，带原因说明
err = trace.DyeUserWithReason(
    tracer, 
    "user123", 
    time.Hour, 
    "support-team",     // 添加者
    "调试登录问题 #12345", // 原因
)
```

### 2. 通过 HTTP API 添加染色用户

```bash
# 添加染色用户
curl -X POST http://localhost:8090/api/_/trace/dyed-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "userId": "user123",
    "ttl": "1h",
    "reason": "调试登录问题 #12345"
  }'

# 查看所有染色用户
curl http://localhost:8090/api/_/trace/dyed-users \
  -H "Authorization: Bearer <admin-token>"

# 删除染色用户
curl -X DELETE http://localhost:8090/api/_/trace/dyed-users/user123 \
  -H "Authorization: Bearer <admin-token>"

# 更新染色 TTL
curl -X PUT http://localhost:8090/api/_/trace/dyed-users/user123/ttl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"ttl": "2h"}'
```

### 3. 通过环境变量预设染色用户

```bash
# 预设染色用户（多个用逗号分隔）
export PB_TRACE_DYE_USERS="user123,user456,user789"

# 设置默认 TTL（支持 Go duration 格式）
export PB_TRACE_DYE_TTL="24h"

# 设置最大染色用户数
export PB_TRACE_DYE_MAX="100"
```

## 配置选项

### Config 结构体

```go
type Config struct {
    // ... 其他配置 ...
    
    // DyeUsers 预设染色用户 ID 列表
    DyeUsers []string
    
    // DyeMaxUsers 最大染色用户数量（默认 100）
    DyeMaxUsers int
    
    // DyeDefaultTTL 默认染色 TTL（默认 1 小时）
    DyeDefaultTTL time.Duration
}
```

### 示例配置

```go
trace.MustRegister(app, trace.Config{
    Mode:          trace.ModeConditional,
    DyeMaxUsers:   100,              // 最多同时染色 100 个用户
    DyeDefaultTTL: 24 * time.Hour,   // 默认 24 小时过期
    DyeUsers:      []string{"vip1", "vip2"}, // 启动时预设的染色用户
})
```

## API 参考

### Programmatic API

| 函数 | 说明 |
|------|------|
| `DyeUser(tracer, userID, ttl)` | 添加染色用户 |
| `DyeUserWithReason(tracer, userID, ttl, addedBy, reason)` | 添加染色用户（带原因）|
| `UndyeUser(tracer, userID)` | 移除染色用户 |
| `IsDyed(tracer, userID) bool` | 检查用户是否被染色 |
| `GetDyedUser(tracer, userID) (*DyedUser, bool)` | 获取染色用户详情 |
| `ListDyedUsers(tracer) []DyedUser` | 列出所有染色用户 |
| `UpdateDyeTTL(tracer, userID, ttl)` | 更新染色 TTL |
| `DyedUserCount(tracer) int` | 获取染色用户数量 |

### DyedUser 结构体

```go
type DyedUser struct {
    UserID    string        `json:"userId"`    // 用户 ID
    AddedAt   time.Time     `json:"addedAt"`   // 添加时间
    ExpiresAt time.Time     `json:"expiresAt"` // 过期时间
    TTL       time.Duration `json:"ttl"`       // 生存时间
    AddedBy   string        `json:"addedBy"`   // 添加者
    Reason    string        `json:"reason"`    // 添加原因
}
```

### HTTP API

| 方法 | 路径 | 请求体 | 说明 |
|------|------|--------|------|
| GET | `/api/_/trace/dyed-users` | - | 获取所有染色用户 |
| POST | `/api/_/trace/dyed-users` | `{userId, ttl?, reason?}` | 添加染色用户 |
| DELETE | `/api/_/trace/dyed-users/:id` | - | 删除染色用户 |
| PUT | `/api/_/trace/dyed-users/:id/ttl` | `{ttl}` | 更新 TTL |

## 工作原理

### 染色检查流程

```
请求进入
    │
    ▼
┌─────────────────┐
│ 提取用户 ID     │ ← 从 Context 或 Header 获取
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 检查是否染色    │ ← DyeStore.IsDyed(userID)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  染色      未染色
    │         │
    ▼         ▼
 全量采集  继续其他过滤器
    │         │
    │    ┌────┴────────────┐
    │    │                 │
    │    ▼                 ▼
    │  通过过滤器        被过滤
    │    │                 │
    └────┼─────────────────┘
         │
         ▼
      记录 Span
```

### Span 属性

染色用户的请求 Span 会携带特殊属性：

```json
{
  "traceId": "abc123...",
  "attributes": {
    "trace.dyed": true,
    "trace.dyed_reason": "调试登录问题 #12345",
    "user.id": "user123"
  }
}
```

## 最佳实践

### 1. 设置合理的 TTL

```go
// ❌ 不推荐：过长的 TTL 可能导致存储压力
trace.DyeUser(tracer, userID, 7*24*time.Hour) // 7 天

// ✅ 推荐：按需设置，问题解决后及时移除
trace.DyeUser(tracer, userID, 2*time.Hour) // 2 小时
```

### 2. 记录染色原因

```go
// ❌ 不推荐：无原因记录
trace.DyeUser(tracer, userID, time.Hour)

// ✅ 推荐：记录工单号或问题描述
trace.DyeUserWithReason(tracer, userID, time.Hour, 
    "support", "工单 #12345: 用户反馈登录失败")
```

### 3. 设置合理的数量上限

```go
// ❌ 不推荐：过高的上限
trace.MustRegister(app, trace.Config{
    DyeMaxUsers: 10000, // 可能导致内存压力
})

// ✅ 推荐：根据实际需求设置
trace.MustRegister(app, trace.Config{
    DyeMaxUsers: 100, // 通常 100 个足够
})
```

### 4. 监控染色用户数量

```go
// 获取 Tracer 实例
tracer := trace.GetTracer(app)

// 定期检查染色用户数量
count := trace.DyedUserCount(tracer)
if count > 50 {
    log.Printf("警告: 当前染色用户数量 %d，请检查是否有未清理的染色", count)
}
```

## 常见问题

### Q: 染色用户的 Span 存储在哪里？

A: 染色用户的 Span 与普通 Span 存储在同一位置（SQLite 或 PostgreSQL 的 `_traces` 表），但会携带 `trace.dyed=true` 属性，方便筛选。

### Q: 染色用户达到上限后会怎样？

A: 尝试添加新用户时会返回 `ErrMaxDyedUsersReached` 错误。需要先移除一些染色用户或增加上限。

### Q: 染色信息在哪里存储？

A: 默认使用 `MemoryDyeStore` 内存存储，重启后会丢失。如需持久化，可使用环境变量 `PB_TRACE_DYE_USERS` 预设。

### Q: 如何查找染色用户的追踪数据？

A: 查询 Trace API 时使用属性过滤：

```bash
# 查询所有染色用户的 Trace
curl "http://localhost:8090/api/_/trace/spans?filter=trace.dyed=true"

# 查询特定染色用户的 Trace
curl "http://localhost:8090/api/_/trace/spans?filter=user.id=user123&filter=trace.dyed=true"
```

## 错误处理

```go
import "github.com/pocketbase/pocketbase/plugins/trace"

tracer := trace.GetTracer(app)
err := trace.DyeUser(tracer, userID, time.Hour)
switch {
case errors.Is(err, trace.ErrNoDyeStore):
    // DyeStore 未初始化（可能 DyeMaxUsers = 0）
    log.Println("染色功能未启用")
    
case errors.Is(err, trace.ErrInvalidTracer):
    // Tracer 无效（可能未注册 trace 插件）
    log.Println("Tracer 未注册")
    
case errors.Is(err, dye.ErrMaxDyedUsersReached):
    // 染色用户数量达到上限
    log.Println("染色用户已满")
    
case err != nil:
    // 其他错误
    log.Printf("染色失败: %v", err)
}
```

## 性能影响

染色检查操作的性能开销很小：

| 操作 | 耗时 | 内存分配 |
|------|------|---------|
| IsDyed (命中) | ~59ns | 0 allocs |
| IsDyed (未命中) | ~26ns | 0 allocs |
| Add | ~100ns | ~100B |
| Remove | ~50ns | 0 allocs |

即使在高并发场景下，染色检查也不会成为性能瓶颈。
