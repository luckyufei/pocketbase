# Jobs Queue

PocketBase has a built-in lightweight job queue system, supporting delayed tasks, auto-retry, concurrent processing, and more. Compatible with both SQLite and PostgreSQL.

## Features

- **Delayed Execution** - Support scheduled task scheduling
- **Auto Retry** - Failed tasks auto-retry with configurable max retries
- **Concurrent Processing** - Worker pool for concurrent task execution
- **Persistent Storage** - Tasks stored in database, survive service restarts
- **Management API** - RESTful API for task management
- **Dual Database Compatibility** - Supports both SQLite and PostgreSQL

## Quick Start

### 1. Register Task Handler

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // Register task handler after app starts
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // Register handler for "send_email" topic
        app.Jobs().Register("send_email", func(job *core.Job) error {
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

        // Start task scheduler
        app.Jobs().Start()

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 2. Enqueue Tasks

```go
// Execute immediately
job, err := app.Jobs().Enqueue("send_email", map[string]any{
    "to":      "user@example.com",
    "subject": "Welcome",
    "body":    "Thanks for signing up!",
})

// Delayed execution (10 minutes later)
job, err := app.Jobs().EnqueueAt("send_email", payload, time.Now().Add(10*time.Minute))

// Enqueue with options
job, err := app.Jobs().EnqueueWithOptions("send_email", payload, &core.JobEnqueueOptions{
    RunAt:      time.Now().Add(1*time.Hour),  // Execute 1 hour later
    MaxRetries: 5,                            // Max 5 retries
})
```

## Task Status

| Status | Description |
|--------|-------------|
| `pending` | Waiting for execution |
| `processing` | Currently executing |
| `completed` | Execution succeeded |
| `failed` | Execution failed (max retries reached) |

## API Endpoints

::: warning Note
All Jobs APIs require Superuser privileges.
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

## Configuration Parameters

| Constant | Default | Description |
|----------|---------|-------------|
| `JobMaxPayloadSize` | 1 MB | Maximum payload size |
| `JobDefaultMaxRetries` | 3 | Default max retries |
| `JobDefaultLockDuration` | 5 minutes | Task lock duration (execution timeout) |
| `JobDefaultPollInterval` | 1 second | Poll interval |
| `JobDefaultWorkerPoolSize` | 10 | Worker pool size |
| `JobDefaultBatchSize` | 10 | Batch fetch task count |

## Error Handling

When task handler returns an error, system auto-retries:

```go
app.Jobs().Register("risky_task", func(job *core.Job) error {
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
app.Jobs().Register("process_order", func(job *core.Job) error {
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
app.Jobs().EnqueueWithOptions("call_webhook", payload, &core.JobEnqueueOptions{
    MaxRetries: 10,
})

// For unrecoverable errors, set fewer retries
app.Jobs().EnqueueWithOptions("send_sms", payload, &core.JobEnqueueOptions{
    MaxRetries: 2,
})
```

### 3. Payload Size Control

Payload max 1MB, for large data, store reference instead of data itself:

```go
// Recommended: Store file ID
app.Jobs().Enqueue("process_file", map[string]any{
    "file_id": "abc123",
})

// Not recommended: Store file content
// app.Jobs().Enqueue("process_file", map[string]any{
//     "content": largeFileContent,  // May exceed 1MB
// })
```

## Database Compatibility

Jobs module is fully compatible with SQLite and PostgreSQL:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Table Structure | TEXT stores JSON | JSONB type |
| Index | Regular index | Partial index (WHERE) |
| Task Fetch | Optimistic lock + CAS | FOR UPDATE SKIP LOCKED |
| Time Type | TEXT | TIMESTAMP |

No code changes needed - the system automatically adapts to different databases.
