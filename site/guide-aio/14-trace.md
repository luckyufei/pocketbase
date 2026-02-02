# Trace (分布式追踪)

## 概述

OpenTelemetry 兼容的分布式追踪，支持 W3C Trace Context、Ring Buffer 缓冲、自动 HTTP 追踪。

## 配置

```go
type TraceConfig struct {
    Enabled         bool          // 是否启用
    BufferSize      int           // Ring Buffer 大小，默认 10000
    FlushInterval   time.Duration // 刷新间隔，默认 1s
    BatchSize       int           // 批量写入大小，默认 100
    RetentionDays   int           // 数据保留天数，默认 7
    SampleRate      float64       // 采样率 0.0-1.0
}
```

## Span 结构

```go
type Span struct {
    TraceID    string            // 32-char Hex
    SpanID     string            // 16-char Hex
    ParentID   string            // 可为空
    Name       string            // 操作名称
    Kind       SpanKind          // INTERNAL/SERVER/CLIENT/PRODUCER/CONSUMER
    StartTime  int64             // 微秒
    Duration   int64             // 微秒
    Status     SpanStatus        // UNSET/OK/ERROR
    Attributes map[string]any
}

type SpanBuilder interface {
    SetAttribute(key string, value any) SpanBuilder
    SetStatus(status SpanStatus, message string) SpanBuilder
    SetKind(kind SpanKind) SpanBuilder
    End()
}
```

## 使用示例

```go
trace := app.Trace()

// 创建 Span
ctx, span := trace.StartSpan(ctx, "my-operation")
span.SetAttribute("user_id", "123")
span.SetKind(SpanKindServer)
defer span.End()

// 嵌套 Span（自动关联 parent）
ctx2, childSpan := trace.StartSpan(ctx, "child-operation")
childSpan.SetStatus(SpanStatusOK, "")
childSpan.End()

// 查询
spans, total, _ := trace.Query(&FilterParams{
    Operation: "http.request",
    RootOnly:  true,
    Limit:     50,
})

// 获取完整调用链
spans, _ := trace.GetTrace("abc123...")

// 统计
stats, _ := trace.Stats(&FilterParams{
    StartTime: time.Now().Add(-1*time.Hour).UnixMicro(),
})
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/traces` | 列表查询 |
| GET | `/api/traces/stats` | 统计数据 |
| GET | `/api/traces/{trace_id}` | 获取完整调用链 |

## Span 类型

| Kind | 描述 |
|------|------|
| `INTERNAL` | 内部操作 |
| `SERVER` | 服务端接收请求 |
| `CLIENT` | 客户端发起请求 |
| `PRODUCER` | 消息生产者 |
| `CONSUMER` | 消息消费者 |

## 自动追踪

HTTP 请求会自动创建 Span，包含以下属性：

- `http.method`: 请求方法
- `http.url`: 请求 URL
- `http.status_code`: 响应状态码
- `http.route`: 路由模式
