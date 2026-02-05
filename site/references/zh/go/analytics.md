# Analytics 用户行为分析

::: info
Analytics 插件是一个**可选的**扩展，用于收集和分析用户行为数据。它采用 opt-in 设计，不注册时零开销。
:::

## 快速开始

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/analytics"
)

func main() {
    app := pocketbase.New()

    // 注册 analytics 插件
    analytics.MustRegister(app, analytics.Config{
        Mode:      analytics.ModeConditional, // 条件采集模式
        Enabled:   true,                      // 启用分析功能
        Retention: 90,                        // 数据保留 90 天
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 运行模式

| 模式 | 常量 | 说明 |
|------|------|------|
| 关闭 | `analytics.ModeOff` | 完全关闭分析，零开销（返回 NoopAnalytics）|
| 条件采集 | `analytics.ModeConditional` | 根据配置条件决定是否采集（默认）|
| 全量采集 | `analytics.ModeFull` | 采集所有请求 |

## 配置选项

```go
type Config struct {
    // Mode 运行模式
    Mode AnalyticsMode

    // Enabled 是否启用（Mode 为 Off 时自动禁用）
    Enabled bool

    // Retention 数据保留天数（默认 90 天）
    Retention int

    // FlushInterval 刷新间隔（默认 10 秒）
    FlushInterval time.Duration

    // BufferSize 缓冲区大小（默认 16MB）
    BufferSize int
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `Mode` | `AnalyticsMode` | `ModeConditional` | 运行模式 |
| `Enabled` | `bool` | `true` | 是否启用 |
| `Retention` | `int` | `90` | 数据保留天数 |
| `FlushInterval` | `time.Duration` | `10s` | 刷新间隔 |
| `BufferSize` | `int` | `16777216` | 缓冲区大小（字节）|

## 环境变量

所有配置都可以通过环境变量覆盖：

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `PB_ANALYTICS_MODE` | 运行模式 | `off`, `conditional`, `full` |
| `PB_ANALYTICS_ENABLED` | 是否启用 | `true`, `false` |
| `PB_ANALYTICS_RETENTION` | 数据保留天数 | `90` |
| `PB_ANALYTICS_FLUSH_INTERVAL` | 刷新间隔（秒）| `10` |
| `PB_ANALYTICS_BUFFER_SIZE` | 缓冲区大小（字节）| `16777216` |

```bash
# 生产环境示例
PB_ANALYTICS_MODE=conditional \
PB_ANALYTICS_RETENTION=30 \
./myapp serve
```

## Programmatic API

```go
// 获取 Analytics 实例
analytics := analytics.GetAnalytics(app)

// 检查是否启用
if analytics.IsEnabled() {
    // 手动推送事件
    err := analytics.Track(&analytics.Event{
        Event:     "purchase",
        Path:      "/checkout/success",
        SessionID: "user-session-123",
        Timestamp: time.Now(),
        // 自定义属性
        Extra: map[string]any{
            "order_id": "ORD-12345",
            "amount":   99.99,
        },
    })
    if err != nil {
        app.Logger().Error("Track failed", "error", err)
    }
}

// 获取当前配置
config := analytics.Config()
fmt.Printf("Retention: %d days\n", config.Retention)

// 立即刷新缓冲区（通常用于优雅关闭）
analytics.Flush()

// 停止 Analytics（会自动刷新剩余数据）
analytics.Stop(context.Background())
```

## 事件结构

```go
type Event struct {
    // ID 事件唯一标识（自动生成）
    ID string

    // Event 事件类型（如 page_view, click, purchase）
    Event string

    // Path 页面路径
    Path string

    // SessionID 会话 ID（用于 UV 去重）
    SessionID string

    // Timestamp 事件时间
    Timestamp time.Time

    // Title 页面标题
    Title string

    // Referrer 来源页面
    Referrer string

    // UserAgent 浏览器 UA
    UserAgent string

    // Browser 浏览器名称（从 UA 解析）
    Browser string

    // OS 操作系统（从 UA 解析）
    OS string

    // PerfMs 页面加载耗时（毫秒）
    PerfMs int

    // Extra 自定义属性
    Extra map[string]any
}
```

## REST API

### 公开端点

用于前端 SDK 上报事件：

```
POST /api/analytics/events
Content-Type: application/json

{
    "events": [
        {
            "event": "page_view",
            "path": "/home",
            "sessionId": "unique-session-id",
            "title": "Home Page",
            "referrer": "https://google.com",
            "perfMs": 300,
            "timestamp": 1706745600000
        }
    ]
}
```

### 管理员端点

需要 Superuser 认证：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/stats` | 获取统计概览（PV、UV、来源等）|
| GET | `/api/analytics/top-pages` | 获取热门页面排行 |
| GET | `/api/analytics/top-sources` | 获取流量来源排行 |
| GET | `/api/analytics/devices` | 获取设备/浏览器统计 |
| GET | `/api/analytics/config` | 获取当前配置 |

**查询参数**：

- `start` - 开始日期（格式：`2024-01-01`）
- `end` - 结束日期（格式：`2024-01-31`）
- `limit` - 返回条数（默认 10）

```bash
# 获取最近 7 天的统计
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8090/api/analytics/stats?start=2024-01-01&end=2024-01-07"

# 获取热门页面 Top 20
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8090/api/analytics/top-pages?limit=20"
```

## 数据存储

### SQLite 模式

数据存储在辅助数据库 `pb_data/auxiliary.db` 中：

| 表名 | 说明 |
|------|------|
| `_analytics_daily` | 每日页面聚合数据（PV、UV、停留时长）|
| `_analytics_sources` | 流量来源聚合数据 |
| `_analytics_devices` | 设备/浏览器聚合数据 |

### PostgreSQL 模式

使用相同的表结构，存储在主数据库中。

## HyperLogLog (HLL)

UV（独立访客）统计使用 HyperLogLog 算法：

- **固定内存**：约 16KB/天/页面
- **误差率**：< 1%
- **跨时间合并**：支持任意时间范围的 UV 合并

```go
// HLL 合并示例（内部实现）
hll1 := analytics.NewHLL()
hll1.Add("user1")
hll1.Add("user2")

hll2 := analytics.NewHLL()
hll2.Add("user2")
hll2.Add("user3")

// 合并后 UV = 3（user1, user2, user3）
hll1.Merge(hll2)
uv := hll1.Count() // 3
```

## Bot 过滤

插件自动过滤常见爬虫流量：

- **搜索引擎**：Googlebot, Bingbot, Baidubot, Yandex
- **AI 爬虫**：GPTBot, ClaudeBot, PerplexityBot
- **SEO 工具**：Semrush, Ahrefs, MJ12bot, Screaming Frog
- **社交媒体**：Facebook, Twitter, LinkedIn, Pinterest
- **监控工具**：UptimeRobot, Pingdom, NewRelic

## 自动数据清理

插件会自动注册 Cron 任务清理过期数据：

- **任务 ID**：`__pbAnalyticsPrune__`
- **执行时间**：每天凌晨 3 点
- **清理范围**：超过 `Retention` 天数的数据

```go
// 可以通过 app.Cron() 查看已注册的任务
jobs := app.Cron().Jobs()
for _, job := range jobs {
    if job.Id() == "__pbAnalyticsPrune__" {
        fmt.Println("Analytics prune job is registered")
    }
}
```

## 前端集成

### 原生 JavaScript

```html
<script>
(function() {
    const sessionId = localStorage.getItem('_pb_sid') || 
        (localStorage.setItem('_pb_sid', crypto.randomUUID()), localStorage.getItem('_pb_sid'));
    
    function track(event, extra = {}) {
        fetch('/api/analytics/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                events: [{
                    event: event,
                    path: location.pathname,
                    sessionId: sessionId,
                    title: document.title,
                    referrer: document.referrer,
                    timestamp: Date.now(),
                    ...extra
                }]
            })
        });
    }
    
    // 页面加载时自动上报
    track('page_view', { perfMs: performance.now() | 0 });
    
    // 暴露全局方法
    window.pbTrack = track;
})();
</script>
```

### React 示例

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function usePageTracking() {
    const location = useLocation();
    
    useEffect(() => {
        fetch('/api/analytics/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                events: [{
                    event: 'page_view',
                    path: location.pathname,
                    sessionId: getSessionId(),
                    title: document.title,
                    timestamp: Date.now()
                }]
            })
        });
    }, [location.pathname]);
}
```

## 性能考虑

| 指标 | 说明 |
|------|------|
| **内存** | Ring Buffer 缓冲事件，默认 16MB |
| **CPU** | HLL 计算复杂度 O(1)，Bot 过滤使用高效正则 |
| **存储** | 每日聚合减少存储量，原始数据按配置保留 |
| **NoOp 模式** | 禁用时返回 NoopAnalytics，零开销 |

## 从旧版迁移

如果从 PocketBase 内置 Analytics（`core/analytics`）迁移：

```go
// 旧版（已废弃）
import "github.com/pocketbase/pocketbase/core"
analytics := app.Analytics()

// 新版（推荐）
import "github.com/pocketbase/pocketbase/plugins/analytics"
analytics.MustRegister(app, analytics.Config{})
analytics := analytics.GetAnalytics(app)
```

数据表结构保持不变，无需数据迁移。

## 完整示例

```go
package main

import (
    "context"
    "log"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/analytics"
)

func main() {
    app := pocketbase.New()

    // 注册 Analytics 插件
    analytics.MustRegister(app, analytics.Config{
        Mode:          analytics.ModeConditional,
        Enabled:       true,
        Retention:     90,
        FlushInterval: 10 * time.Second,
        BufferSize:    16 * 1024 * 1024,
    })

    // 自定义事件追踪钩子
    app.OnRecordCreate("orders").BindFunc(func(e *core.RecordEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // 追踪订单创建事件
        a := analytics.GetAnalytics(app)
        if a.IsEnabled() {
            _ = a.Track(&analytics.Event{
                Event:     "order_created",
                Path:      "/api/collections/orders/records",
                SessionID: e.Record.GetString("user_id"),
                Extra: map[string]any{
                    "order_id": e.Record.Id,
                    "amount":   e.Record.GetFloat("amount"),
                },
            })
        }

        return nil
    })

    // 优雅关闭
    go func() {
        sigCh := make(chan os.Signal, 1)
        signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
        <-sigCh

        a := analytics.GetAnalytics(app)
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        _ = a.Stop(ctx)
    }()

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```
