# KV Plugin

PocketBase KV 插件提供类 Redis 的键值存储功能，支持两级缓存架构（L1 内存缓存 + L2 数据库存储）。

## 特性

- **两级缓存**: L1 进程内缓存（sync.Map）+ L2 数据库持久化
- **多数据库支持**: SQLite 和 PostgreSQL
- **TTL 支持**: 自动过期和清理
- **原子操作**: INCR/DECR/HINCR 等原子计数器
- **Hash 操作**: HSET/HGET/HGETALL/HDEL
- **分布式锁**: Lock/Unlock 基本锁功能
- **批量操作**: MSET/MGET
- **可选 HTTP API**: 通过配置启用 REST 端点

## 快速开始

### 基础用法

```go
package main

import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/kv"
)

func main() {
    app := pocketbase.New()
    
    // 注册 KV 插件（使用默认配置）
    kv.MustRegister(app, kv.DefaultConfig())
    
    // 在其他地方使用
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        store := kv.GetStore(app)
        
        // 设置值
        store.Set("user:1", "allen")
        
        // 获取值
        value, err := store.Get("user:1")
        
        // 设置带 TTL 的值
        store.SetEx("session:abc", sessionData, 30*time.Minute)
        
        return se.Next()
    })
    
    app.Start()
}
```

### 自定义配置

```go
kv.MustRegister(app, kv.Config{
    L1Enabled:       true,                    // 启用 L1 缓存
    L1TTL:           10 * time.Second,        // L1 缓存 TTL
    L1MaxSize:       200 * 1024 * 1024,       // L1 最大 200MB
    CleanupInterval: 5 * time.Minute,         // 每 5 分钟清理过期数据
    MaxKeyLength:    512,                     // 最大 key 长度
    MaxValueSize:    5 << 20,                 // 最大值大小 5MB
    HTTPEnabled:     true,                    // 启用 HTTP API
    ReadRule:        "",                      // 读取权限规则
    WriteRule:       "",                      // 写入权限规则
    AllowedPrefixes: []string{"cache:", "session:"}, // 允许的 key 前缀
})
```

## 环境变量

支持通过环境变量覆盖配置：

| 环境变量 | 说明 | 默认值 |
|---------|------|-------|
| `PB_KV_L1_ENABLED` | 启用 L1 缓存 | `true` |
| `PB_KV_L1_TTL` | L1 缓存 TTL（秒） | `5` |
| `PB_KV_L1_MAX_SIZE` | L1 最大大小（MB） | `100` |
| `PB_KV_CLEANUP_INTERVAL` | 清理间隔（秒） | `60` |
| `PB_KV_HTTP_ENABLED` | 启用 HTTP API | `false` |

## API 参考

### 基础操作

```go
// 设置值
err := store.Set(key, value)

// 设置带 TTL 的值
err := store.SetEx(key, value, ttl)

// 获取值
value, err := store.Get(key)

// 删除值
err := store.Delete(key)

// 检查 key 是否存在
exists, err := store.Exists(key)
```

### TTL 操作

```go
// 获取剩余 TTL
ttl, err := store.TTL(key)

// 设置过期时间
err := store.Expire(key, ttl)
```

### 计数器操作

```go
// 自增 1
newValue, err := store.Incr(key)

// 自增指定值
newValue, err := store.IncrBy(key, delta)

// 自减 1
newValue, err := store.Decr(key)
```

### Hash 操作

```go
// 设置 Hash 字段
err := store.HSet(key, field, value)

// 获取 Hash 字段
value, err := store.HGet(key, field)

// 获取所有 Hash 字段
fields, err := store.HGetAll(key)

// 删除 Hash 字段
err := store.HDel(key, field)

// Hash 字段自增
newValue, err := store.HIncrBy(key, field, delta)
```

### 分布式锁

```go
// 获取锁
lockId, err := store.Lock(key, ttl)

// 释放锁
err := store.Unlock(key, lockId)
```

### 批量操作

```go
// 批量设置
err := store.MSet(map[string]any{
    "key1": "value1",
    "key2": "value2",
})

// 批量获取
values, err := store.MGet([]string{"key1", "key2"})
```

### 查询操作

```go
// 按模式匹配 key
keys, err := store.Keys("user:*")
```

## HTTP API

当 `HTTPEnabled` 设置为 `true` 时，以下端点可用：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/kv/set` | 设置值 |
| GET | `/api/kv/get` | 获取值 |
| DELETE | `/api/kv/delete` | 删除值 |
| GET | `/api/kv/exists` | 检查存在 |
| GET | `/api/kv/ttl` | 获取 TTL |
| POST | `/api/kv/expire` | 设置过期 |
| POST | `/api/kv/incr` | 自增 |
| POST | `/api/kv/decr` | 自减 |
| POST | `/api/kv/hset` | 设置 Hash |
| GET | `/api/kv/hget` | 获取 Hash |
| GET | `/api/kv/hgetall` | 获取所有 Hash |
| POST | `/api/kv/hdel` | 删除 Hash 字段 |
| POST | `/api/kv/hincrby` | Hash 自增 |
| POST | `/api/kv/mset` | 批量设置 |
| POST | `/api/kv/mget` | 批量获取 |
| POST | `/api/kv/lock` | 获取锁 |
| POST | `/api/kv/unlock` | 释放锁 |
| GET | `/api/kv/keys` | 匹配 Key |

默认情况下，所有 HTTP 端点需要超级用户权限。

## 错误处理

```go
import "github.com/pocketbase/pocketbase/plugins/kv"

value, err := store.Get("key")
if err != nil {
    switch err {
    case kv.ErrNotFound:
        // Key 不存在
    case kv.ErrKeyTooLong:
        // Key 长度超限
    case kv.ErrValueTooLarge:
        // 值大小超限
    default:
        // 其他错误
    }
}
```

## 架构

```
┌─────────────────────────────────────┐
│           KV Store API              │
│  (Set/Get/Delete/Incr/Hash/Lock)    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     L1 Cache (sync.Map)             │
│  - 进程内缓存                        │
│  - 配置化 TTL（默认 5s）             │
│  - 写操作触发失效                    │
└─────────────┬───────────────────────┘
              │ Cache Miss
              ▼
┌─────────────────────────────────────┐
│     L2 Database Storage             │
│  - SQLite / PostgreSQL              │
│  - 持久化存储                        │
│  - 自动过期清理                      │
└─────────────────────────────────────┘
```

## 注意事项

1. **L1 缓存一致性**: 在多实例部署时，L1 缓存不会跨实例同步。建议在这种场景下禁用 L1 缓存或使用较短的 TTL。

2. **Key 命名**: 建议使用命名空间前缀（如 `user:`, `session:`, `cache:`）来组织 key。

3. **值序列化**: 所有值都会被 JSON 序列化存储。确保存储的值是 JSON 可序列化的。

4. **TTL 精度**: 过期清理是周期性的（默认每分钟），实际过期时间可能略有延迟。

## 迁移自 core.KV()

如果你之前使用的是 `core.App.KV()` 方法，请按以下步骤迁移：

1. 添加 KV 插件注册：
   ```go
   import "github.com/pocketbase/pocketbase/plugins/kv"
   
   kv.MustRegister(app, kv.DefaultConfig())
   ```

2. 将 `app.KV()` 调用替换为 `kv.GetStore(app)`：
   ```go
   // 旧代码
   app.KV().Set("key", "value")
   
   // 新代码
   kv.GetStore(app).Set("key", "value")
   ```
