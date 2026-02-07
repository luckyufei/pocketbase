# Jobs Queue

PocketBase provides a lightweight job queue plugin supporting delayed tasks, auto-retry, concurrent processing, and more. Compatible with both SQLite and PostgreSQL.

::: tip Plugin-based Design
Starting from the latest version, the Jobs feature has been migrated to the `plugins/jobs` plugin, following the Opt-in principle. You need to explicitly register the plugin to use this feature.
:::

## Features

- **Delayed Execution** - Support scheduled task scheduling
- **Auto Retry** - Failed tasks auto-retry with configurable max retries
- **Concurrent Processing** - Worker pool for concurrent task execution
- **Persistent Storage** - Tasks stored in database, survive service restarts
- **Crash Recovery** - Tasks automatically picked up by other workers when one crashes
- **Management API** - RESTful API for task management
- **Dual Database Compatibility** - Supports both SQLite and PostgreSQL

## Quick Start

### 1. Register Plugin and Task Handler

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/jobs"
)

func main() {
    app := pocketbase.New()

    // Register jobs plugin
    jobs.MustRegister(app, jobs.DefaultConfig())

    // Register task handler after app bootstraps
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // Get JobStore instance
        store := jobs.GetJobStore(app)
        if store == nil {
            return nil // Plugin not registered
        }

        // Register handler for "send_email" topic
        store.Register("send_email", func(job *jobs.Job) error {
            // Parse Payload
            var payload struct {
                To      string `json:"to"`
                Subject string `json:"subject"`
                Body    string `json:"body"`
            }
            if err := job.UnmarshalPayload(&payload); err != nil {
                return err
            }

            // Execute task logic
            log.Printf("Sending email to %s: %s", payload.To, payload.Subject)
            // ... actual email sending code

            return nil
        })

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 2. Enqueue Tasks

```go
import "github.com/pocketbase/pocketbase/plugins/jobs"

// Get JobStore
store := jobs.GetJobStore(app)

// Execute immediately
job, err := store.Enqueue("send_email", map[string]any{
    "to":      "user@example.com",
    "subject": "Welcome",
    "body":    "Thanks for signing up!",
})

// Delayed execution (10 minutes later)
job, err := store.EnqueueAt("send_email", payload, time.Now().Add(10*time.Minute))

// Enqueue with options
job, err := store.EnqueueWithOptions("send_email", payload, &jobs.JobEnqueueOptions{
    RunAt:      time.Now().Add(1*time.Hour),  // Execute 1 hour later
    MaxRetries: 5,                            // Max 5 retries
})
```

## Configuration

```go
jobs.MustRegister(app, jobs.Config{
    // Disable plugin (env: PB_JOBS_DISABLED)
    Disabled: false,

    // Worker pool size (env: PB_JOBS_WORKERS, default: 10)
    Workers: 10,

    // Poll interval (env: PB_JOBS_POLL_INTERVAL, default: 1s)
    PollInterval: time.Second,

    // Task lock duration (env: PB_JOBS_LOCK_DURATION, default: 5m)
    LockDuration: 5 * time.Minute,

    // Batch fetch task count (env: PB_JOBS_BATCH_SIZE, default: 10)
    BatchSize: 10,

    // Default max retries (default: 3)
    MaxRetries: 3,

    // Max payload size (default: 1MB)
    MaxPayloadSize: 1 << 20,

    // Enable HTTP API (env: PB_JOBS_HTTP_ENABLED, default: true)
    HTTPEnabled: true,

    // Enqueue permission rule (default: "" Superuser only)
    EnqueueRule: "",

    // Manage permission rule (default: "" Superuser only)
    ManageRule: "",

    // Topic whitelist (optional, empty allows all)
    AllowedTopics: []string{},

    // Auto-start Dispatcher (env: PB_JOBS_AUTO_START, default: true)
    AutoStart: true,
})
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PB_JOBS_DISABLED` | Disable plugin | `false` |
| `PB_JOBS_WORKERS` | Worker count | `10` |
| `PB_JOBS_POLL_INTERVAL` | Poll interval | `1s` |
| `PB_JOBS_LOCK_DURATION` | Lock duration | `5m` |
| `PB_JOBS_BATCH_SIZE` | Batch fetch count | `10` |
| `PB_JOBS_HTTP_ENABLED` | Enable HTTP API | `true` |
| `PB_JOBS_AUTO_START` | Auto-start Dispatcher | `true` |

## Task Status

| Status | Description |
|--------|-------------|
| `pending` | Waiting for execution |
| `processing` | Currently executing |
| `completed` | Execution succeeded |
| `failed` | Execution failed (max retries reached) |

## API Endpoints

::: warning Note
All Jobs APIs require Superuser privileges by default. You can customize permissions via `EnqueueRule` and `ManageRule` configuration.
:::

### Enqueue Task

```http
POST /api/jobs/enqueue
Content-Type: application/json

{
    "topic": "send_email",
    "payload": {
        "to": "user@example.com",
        "subject": "Hello"
    },
    "run_at": "2025-01-08T12:00:00Z",  // Optional, delayed execution
    "max_retries": 5                    // Optional, max retries
}
```

**Response:**
```json
{
    "id": "01234567-89ab-cdef-0123-456789abcdef",
    "topic": "send_email",
    "payload": {"to": "user@example.com", "subject": "Hello"},
    "status": "pending",
    "run_at": "2025-01-08T12:00:00Z",
    "retries": 0,
    "max_retries": 5,
    "created": "2025-01-08T10:00:00Z",
    "updated": "2025-01-08T10:00:00Z"
}
```

### Get Task List

```http
GET /api/jobs?topic=send_email&status=pending&limit=20&offset=0
```

**Query Parameters:**
- `topic` - Filter by topic
- `status` - Filter by status (`pending`, `processing`, `completed`, `failed`)
- `limit` - Return count (default 20)
- `offset` - Offset

**Response:**
```json
{
    "items": [...],
    "total": 100,
    "limit": 20,
    "offset": 0
}
```

### Get Single Task

```http
GET /api/jobs/{id}
```

### Get Statistics

```http
GET /api/jobs/stats
```

**Response:**
```json
{
    "pending": 10,
    "processing": 2,
    "completed": 100,
    "failed": 5,
    "total": 117,
    "success_rate": 0.952
}
```

### Requeue Failed Task

```http
POST /api/jobs/{id}/requeue
```

::: info Tip
Only `failed` status tasks can be requeued.
:::

### Delete Task

```http
DELETE /api/jobs/{id}
```

::: info Tip
Only `pending` or `failed` status tasks can be deleted.
:::

## Go API

### Query Tasks

```go
store := jobs.GetJobStore(app)

// Get single task
job, err := store.Get("job-id")

// List query
result, err := store.List(&jobs.JobFilter{
    Topic:  "send_email",
    Status: "pending",
    Limit:  20,
    Offset: 0,
})

// Get statistics
stats, err := store.Stats()
```

### Manage Tasks

```go
// Delete task (only pending/failed status)
err := store.Delete("job-id")

// Requeue (only failed status)
job, err := store.Requeue("job-id")
```

### Manual Dispatcher Control

```go
// If configured with AutoStart: false, need to start manually
store.Start()

// Stop Dispatcher
store.Stop()
```

## Error Handling

When task handler returns an error, system auto-retries:

```go
store.Register("risky_task", func(job *jobs.Job) error {
    if err := doSomethingRisky(); err != nil {
        // Returning error triggers retry
        return err
    }
    return nil
})
```

- Each retry increments `retries` count
- After reaching `max_retries`, task status changes to `failed`
- Failed tasks can be manually requeued via API or UI

## Retry Strategy

Failed tasks retry using exponential backoff:

- 1st retry: 1 minute later
- 2nd retry: 4 minutes later
- 3rd retry: 9 minutes later
- ...

## Crash Recovery

When a worker crashes or times out, tasks are automatically picked up by other workers after `locked_until` expires. Default lock duration is 5 minutes.

## UI Management

In PocketBase Admin UI, navigate to **Settings → Jobs** to:

- View task list and status
- Filter by topic/status
- View task details and Payload
- Requeue failed tasks
- Delete tasks
- View statistics

## Best Practices

### 1. Idempotent Design

Tasks may execute multiple times due to retries, ensure handlers are idempotent:

```go
store.Register("process_order", func(job *jobs.Job) error {
    var payload struct {
        OrderID string `json:"order_id"`
    }
    job.UnmarshalPayload(&payload)

    // Check if order already processed
    if isOrderProcessed(payload.OrderID) {
        return nil // Already processed, return success
    }

    return processOrder(payload.OrderID)
})
```

### 2. Set Appropriate Retry Count

```go
// For network request tasks, set more retries
store.EnqueueWithOptions("call_webhook", payload, &jobs.JobEnqueueOptions{
    MaxRetries: 10,
})

// For unrecoverable errors, set fewer retries
store.EnqueueWithOptions("send_sms", payload, &jobs.JobEnqueueOptions{
    MaxRetries: 2,
})
```

### 3. Payload Size Control

Payload max 1MB, for large data, store reference instead of data itself:

```go
// Recommended: Store file ID
store.Enqueue("process_file", map[string]any{
    "file_id": "abc123",
})

// Not recommended: Store file content
// store.Enqueue("process_file", map[string]any{
//     "content": largeFileContent,  // May exceed 1MB
// })
```

### 4. Topic Whitelist

Restrict enqueueable topics via `AllowedTopics` configuration:

```go
jobs.MustRegister(app, jobs.Config{
    AllowedTopics: []string{"email:send", "sms:send", "webhook:call"},
})
```

## Database Compatibility

Jobs plugin is fully compatible with SQLite and PostgreSQL:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Table Structure | TEXT stores JSON | JSONB type |
| Index | Regular index | Partial index (WHERE) |
| Task Fetch | Optimistic lock + CAS | FOR UPDATE SKIP LOCKED |
| Time Type | TEXT | TIMESTAMP |
| Concurrency | Moderate | High |

No code changes needed - the system automatically adapts to different databases.

## Important Notes

1. **Topic Must Be Registered**: Only topics with registered handlers will be fetched by Dispatcher
2. **Payload Size Limit**: Default max 1MB
3. **Idempotency**: Workers should be designed to be idempotent, as tasks may execute multiple times
4. **Transaction Support**: Tasks enqueued within a transaction become visible after commit
5. **Opt-in Design**: Without registering the plugin, `_jobs` table won't be created, zero overhead

## Migration Guide

If migrating from older version (using `app.Jobs()` API), see [Migration Guide](/docs/MIGRATION_JOBS_PLUGIN.md).

Key changes:
- `app.Jobs()` → `jobs.GetJobStore(app)`
- `core.Job` → `jobs.Job`
- `core.JobFilter` → `jobs.JobFilter`
- Must explicitly register plugin: `jobs.MustRegister(app, jobs.DefaultConfig())`
