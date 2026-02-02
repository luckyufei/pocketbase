# Analytics

## 概述

网站分析系统，支持 PV/UV 统计、HyperLogLog 去重、S3 原始日志存储。

## 配置

```go
type AnalyticsConfig struct {
    Enabled       bool   // 默认 true
    Retention     int    // 数据保留天数，默认 90
    S3Bucket      string // S3 存储
    S3Endpoint    string
    S3Region      string
    FlushInterval int    // 刷新间隔秒，默认 10
    RawBufferSize int    // 缓冲区大小，默认 16MB
}
```

## 使用示例

```go
analytics := app.Analytics()

if analytics.IsEnabled() {
    // 推送事件
    event := &AnalyticsEvent{
        Path:      "/blog/hello",
        Referrer:  "https://google.com",
        UserAgent: "Mozilla/5.0...",
        IP:        "1.2.3.4",
    }
    analytics.Push(event)
    
    // 清理过期数据
    analytics.Prune(ctx)
}
```

## API 端点

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| POST | `/api/analytics/events` | 公开 | 接收事件 |
| GET | `/api/analytics/stats` | Superuser | 查询统计 |
| GET | `/api/analytics/top-pages` | Superuser | Top 页面 |
| GET | `/api/analytics/top-sources` | Superuser | Top 来源 |
| GET | `/api/analytics/devices` | Superuser | 设备分布 |
| GET | `/api/analytics/raw-logs` | Superuser | 原始日志 |

## 统计查询

```javascript
// 获取统计数据
const stats = await pb.send('/api/analytics/stats', {
    method: 'GET',
    query: {
        start: '2024-01-01',
        end: '2024-01-31'
    }
});

// 获取 Top 页面
const topPages = await pb.send('/api/analytics/top-pages', {
    method: 'GET',
    query: {
        limit: 10
    }
});
```

## 事件结构

```go
type AnalyticsEvent struct {
    Path       string    // 页面路径
    Referrer   string    // 来源
    UserAgent  string    // 用户代理
    IP         string    // IP 地址
    Country    string    // 国家
    Device     string    // 设备类型
    Browser    string    // 浏览器
    OS         string    // 操作系统
    Timestamp  time.Time // 时间戳
}
```
