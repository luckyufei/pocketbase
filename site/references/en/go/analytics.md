# Analytics User Behavior

::: info
The Analytics plugin is an **optional** extension for collecting and analyzing user behavior data. It uses an opt-in design with zero overhead when not registered.
:::

## Quick Start

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/analytics"
)

func main() {
    app := pocketbase.New()

    // Register analytics plugin
    analytics.MustRegister(app, analytics.Config{
        Mode:      analytics.ModeConditional, // Conditional collection mode
        Enabled:   true,                      // Enable analytics
        Retention: 90,                        // Retain data for 90 days
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Operating Modes

| Mode | Constant | Description |
|------|----------|-------------|
| Off | `analytics.ModeOff` | Completely disabled, zero overhead (returns NoopAnalytics) |
| Conditional | `analytics.ModeConditional` | Collect based on configuration (default) |
| Full | `analytics.ModeFull` | Collect all requests |

## Configuration Options

```go
type Config struct {
    // Mode operating mode
    Mode AnalyticsMode

    // Enabled whether analytics is enabled (auto-disabled when Mode is Off)
    Enabled bool

    // Retention data retention in days (default 90)
    Retention int

    // FlushInterval flush interval (default 10 seconds)
    FlushInterval time.Duration

    // BufferSize buffer size (default 16MB)
    BufferSize int
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `Mode` | `AnalyticsMode` | `ModeConditional` | Operating mode |
| `Enabled` | `bool` | `true` | Whether enabled |
| `Retention` | `int` | `90` | Data retention days |
| `FlushInterval` | `time.Duration` | `10s` | Flush interval |
| `BufferSize` | `int` | `16777216` | Buffer size in bytes |

## Environment Variables

All configurations can be overridden via environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `PB_ANALYTICS_MODE` | Operating mode | `off`, `conditional`, `full` |
| `PB_ANALYTICS_ENABLED` | Whether enabled | `true`, `false` |
| `PB_ANALYTICS_RETENTION` | Retention days | `90` |
| `PB_ANALYTICS_FLUSH_INTERVAL` | Flush interval (seconds) | `10` |
| `PB_ANALYTICS_BUFFER_SIZE` | Buffer size (bytes) | `16777216` |

```bash
# Production example
PB_ANALYTICS_MODE=conditional \
PB_ANALYTICS_RETENTION=30 \
./myapp serve
```

## Programmatic API

```go
// Get Analytics instance
analytics := analytics.GetAnalytics(app)

// Check if enabled
if analytics.IsEnabled() {
    // Manually track event
    err := analytics.Track(&analytics.Event{
        Event:     "purchase",
        Path:      "/checkout/success",
        SessionID: "user-session-123",
        Timestamp: time.Now(),
        // Custom properties
        Extra: map[string]any{
            "order_id": "ORD-12345",
            "amount":   99.99,
        },
    })
    if err != nil {
        app.Logger().Error("Track failed", "error", err)
    }
}

// Get current configuration
config := analytics.Config()
fmt.Printf("Retention: %d days\n", config.Retention)

// Immediately flush buffer (typically for graceful shutdown)
analytics.Flush()

// Stop Analytics (will auto-flush remaining data)
analytics.Stop(context.Background())
```

## Event Structure

```go
type Event struct {
    // ID unique event identifier (auto-generated)
    ID string

    // Event type (e.g., page_view, click, purchase)
    Event string

    // Path page path
    Path string

    // SessionID session ID (used for UV deduplication)
    SessionID string

    // Timestamp event time
    Timestamp time.Time

    // Title page title
    Title string

    // Referrer referring page
    Referrer string

    // UserAgent browser UA
    UserAgent string

    // Browser browser name (parsed from UA)
    Browser string

    // OS operating system (parsed from UA)
    OS string

    // PerfMs page load time (milliseconds)
    PerfMs int

    // Extra custom properties
    Extra map[string]any
}
```

## REST API

### Public Endpoints

For frontend SDK event reporting:

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

### Admin Endpoints

Requires Superuser authentication:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/stats` | Get statistics overview (PV, UV, sources, etc.) |
| GET | `/api/analytics/top-pages` | Get top pages ranking |
| GET | `/api/analytics/top-sources` | Get traffic sources ranking |
| GET | `/api/analytics/devices` | Get device/browser statistics |
| GET | `/api/analytics/config` | Get current configuration |

**Query Parameters**:

- `start` - Start date (format: `2024-01-01`)
- `end` - End date (format: `2024-01-31`)
- `limit` - Number of results (default 10)

```bash
# Get stats for last 7 days
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8090/api/analytics/stats?start=2024-01-01&end=2024-01-07"

# Get Top 20 pages
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8090/api/analytics/top-pages?limit=20"
```

## Data Storage

### SQLite Mode

Data is stored in the auxiliary database `pb_data/auxiliary.db`:

| Table | Description |
|-------|-------------|
| `_analytics_daily` | Daily page aggregation data (PV, UV, duration) |
| `_analytics_sources` | Traffic source aggregation data |
| `_analytics_devices` | Device/browser aggregation data |

### PostgreSQL Mode

Uses the same table structure, stored in the main database.

## HyperLogLog (HLL)

UV (unique visitors) statistics use the HyperLogLog algorithm:

- **Fixed memory**: ~16KB/day/page
- **Error rate**: < 1%
- **Cross-time merging**: Supports UV merging across any time range

```go
// HLL merge example (internal implementation)
hll1 := analytics.NewHLL()
hll1.Add("user1")
hll1.Add("user2")

hll2 := analytics.NewHLL()
hll2.Add("user2")
hll2.Add("user3")

// After merge UV = 3 (user1, user2, user3)
hll1.Merge(hll2)
uv := hll1.Count() // 3
```

## Bot Filtering

The plugin automatically filters common crawler traffic:

- **Search engines**: Googlebot, Bingbot, Baidubot, Yandex
- **AI crawlers**: GPTBot, ClaudeBot, PerplexityBot
- **SEO tools**: Semrush, Ahrefs, MJ12bot, Screaming Frog
- **Social media**: Facebook, Twitter, LinkedIn, Pinterest
- **Monitoring tools**: UptimeRobot, Pingdom, NewRelic

## Automatic Data Cleanup

The plugin automatically registers a Cron job to clean up expired data:

- **Job ID**: `__pbAnalyticsPrune__`
- **Schedule**: Daily at 3 AM
- **Scope**: Data older than `Retention` days

```go
// You can view registered jobs via app.Cron()
jobs := app.Cron().Jobs()
for _, job := range jobs {
    if job.Id() == "__pbAnalyticsPrune__" {
        fmt.Println("Analytics prune job is registered")
    }
}
```

## Frontend Integration

### Vanilla JavaScript

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
    
    // Auto-track on page load
    track('page_view', { perfMs: performance.now() | 0 });
    
    // Expose global method
    window.pbTrack = track;
})();
</script>
```

### React Example

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

## Performance Considerations

| Metric | Description |
|--------|-------------|
| **Memory** | Ring Buffer for events, default 16MB |
| **CPU** | HLL computation O(1), efficient regex for bot filtering |
| **Storage** | Daily aggregation reduces storage, raw data retained per config |
| **NoOp Mode** | Returns NoopAnalytics when disabled, zero overhead |

## Migration from Legacy

If migrating from PocketBase built-in Analytics (`core/analytics`):

```go
// Legacy (deprecated)
import "github.com/pocketbase/pocketbase/core"
analytics := app.Analytics()

// New (recommended)
import "github.com/pocketbase/pocketbase/plugins/analytics"
analytics.MustRegister(app, analytics.Config{})
analytics := analytics.GetAnalytics(app)
```

Table structure remains unchanged, no data migration needed.

## Complete Example

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

    // Register Analytics plugin
    analytics.MustRegister(app, analytics.Config{
        Mode:          analytics.ModeConditional,
        Enabled:       true,
        Retention:     90,
        FlushInterval: 10 * time.Second,
        BufferSize:    16 * 1024 * 1024,
    })

    // Custom event tracking hook
    app.OnRecordCreate("orders").BindFunc(func(e *core.RecordEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // Track order creation event
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

    // Graceful shutdown
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
