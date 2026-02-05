# Analytics Plugin

原生用户行为分析插件，提供事件采集、聚合和 Dashboard 功能。

## 快速开始

```go
import (
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
    
    app.Start()
}
```

## 运行模式 (AnalyticsMode)

| 模式 | 常量 | 说明 |
|------|------|------|
| 关闭 | `analytics.ModeOff` | 完全关闭分析，零开销 |
| 条件采集 | `analytics.ModeConditional` | 根据配置条件决定是否采集（默认）|
| 全量采集 | `analytics.ModeFull` | 采集所有请求 |

## 配置选项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `Mode` | `AnalyticsMode` | `ModeConditional` | 运行模式 |
| `Enabled` | `bool` | `true` | 是否启用 |
| `Retention` | `int` | `90` | 数据保留天数 |
| `FlushInterval` | `time.Duration` | `10s` | 刷新间隔 |
| `BufferSize` | `int` | `16MB` | 缓冲区大小 |

## 环境变量

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `PB_ANALYTICS_MODE` | 运行模式 | `off`, `conditional`, `full` |
| `PB_ANALYTICS_ENABLED` | 是否启用 | `true`, `false` |
| `PB_ANALYTICS_RETENTION` | 数据保留天数 | `90` |
| `PB_ANALYTICS_FLUSH_INTERVAL` | 刷新间隔（秒）| `10` |
| `PB_ANALYTICS_BUFFER_SIZE` | 缓冲区大小（字节）| `16777216` |

## API 端点

### 公开端点（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/analytics/events` | 接收事件数据 |

### 管理员端点（需要 Superuser 认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/stats` | 获取统计概览 |
| GET | `/api/analytics/top-pages` | 获取热门页面 |
| GET | `/api/analytics/top-sources` | 获取流量来源 |
| GET | `/api/analytics/devices` | 获取设备统计 |
| GET | `/api/analytics/raw-logs` | 获取原始日志列表 |
| GET | `/api/analytics/raw-logs/{date}` | 下载指定日期原始日志 |
| GET | `/api/analytics/config` | 获取当前配置 |

## 事件格式

```json
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

### 事件字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `event` | 否 | 事件类型，默认 `page_view` |
| `path` | 是 | 页面路径 |
| `sessionId` | 是 | 会话 ID（用于 UV 统计）|
| `title` | 否 | 页面标题 |
| `referrer` | 否 | 来源页面 |
| `perfMs` | 否 | 页面加载耗时（毫秒）|
| `timestamp` | 否 | 事件时间戳（毫秒）|

## 使用 Programmatic API

```go
// 获取 Analytics 实例
analytics := analytics.GetAnalytics(app)

// 检查是否启用
if analytics.IsEnabled() {
    // 手动推送事件
    err := analytics.Track(&analytics.Event{
        Event:     "custom_event",
        Path:      "/api/action",
        SessionID: "user-session-123",
        Timestamp: time.Now(),
    })
}

// 获取配置
config := analytics.Config()

// 立即刷新缓冲区
analytics.Flush()
```

## 数据存储

### SQLite 模式

数据存储在辅助数据库（`pb_data/auxiliary.db`）中，包含以下表：

- `_analytics_daily` - 每日页面统计
- `_analytics_sources` - 流量来源统计
- `_analytics_devices` - 设备统计

### PostgreSQL 模式

数据存储在主数据库中，使用相同的表结构。

## Bot 过滤

插件自动过滤常见爬虫流量，包括：

- Googlebot, Bingbot, Baidubot
- GPTBot, ClaudeBot
- Semrush, Ahrefs, MJ12bot
- 社交媒体爬虫（Facebook, Twitter, LinkedIn 等）

## HyperLogLog (HLL)

UV（独立访客）统计使用 HyperLogLog 算法，具有以下特点：

- 固定内存占用（约 16KB/天/页面）
- 误差率 < 1%
- 支持跨时间范围合并

## 性能考虑

- **内存**: 使用 Ring Buffer 缓冲事件，默认 16MB
- **CPU**: HLL 计算复杂度 O(1)
- **存储**: 每日聚合，原始数据按天归档
- **NoOp 模式**: 禁用时零开销

## 迁移说明

如果从旧版 PocketBase（core/analytics）迁移：

1. 更新 import 路径：
   ```go
   // 旧版
   import "github.com/pocketbase/pocketbase/core"
   analytics := app.Analytics()
   
   // 新版
   import "github.com/pocketbase/pocketbase/plugins/analytics"
   analytics := analytics.GetAnalytics(app)
   ```

2. 注册插件（在 `app.Start()` 之前）：
   ```go
   analytics.MustRegister(app, analytics.Config{})
   ```

3. 数据表结构保持不变，无需数据迁移
