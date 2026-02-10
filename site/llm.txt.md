
# PocketBase - Comprehensive LLM Reference

> PocketBase is an open source backend in a single binary. It provides a realtime database (SQLite + PostgreSQL), built-in auth, file storage, admin dashboard, and a simple REST API. This fork extends the original PocketBase with PostgreSQL support, secrets management, job queue, proxy gateway, process manager, and more.

---

## TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Collections & Fields](#collections--fields)
4. [Authentication](#authentication)
5. [API Rules & Filters](#api-rules--filters)
6. [Records API](#records-api)
7. [Realtime API](#realtime-api)
8. [Files Handling](#files-handling)
9. [Working with Relations](#working-with-relations)
10. [PostgreSQL Support](#postgresql-support)
11. [Secrets Management](#secrets-management)
12. [Jobs Queue](#jobs-queue)
13. [Proxy Gateway](#proxy-gateway)
14. [Process Manager](#process-manager)
15. [CLI Reference](#cli-reference)
16. [Extending with Go](#extending-with-go)
17. [Extending with JavaScript](#extending-with-javascript)
18. [Go Database Operations](#go-database-operations)
19. [Go Record Operations](#go-record-operations)
20. [Go Routing](#go-routing)
21. [Settings API](#settings-api)
22. [Backups API](#backups-api)
23. [Logs & Health API](#logs--health-api)
24. [Going to Production](#going-to-production)

---

## QUICK START

### Installation & Run

```bash
# Download prebuilt binary or build from source
./pocketbase serve                          # Start with SQLite (default)
./pocketbase serve yourdomain.com           # Start with auto TLS
./pocketbase serve --dev                    # Dev mode with SQL logging
./pocketbase superuser create EMAIL PASS    # Create first superuser
```

### Default Routes

- `http://127.0.0.1:8090` - Static files from `pb_public` directory
- `http://127.0.0.1:8090/_/` - Superusers dashboard
- `http://127.0.0.1:8090/api/` - REST API

### Directory Structure

- `pb_data` - Application data, uploaded files (add to .gitignore)
- `pb_migrations` - JS migration files (commit to repository)
- `pb_hooks` - Custom JavaScript hook files
- `pb_public` - Static files served at root URL

### SDK Clients

- **JavaScript SDK**: `npm install pocketbase` (Browser, Node.js, React Native)
- **Dart SDK**: `dart pub add pocketbase` (Web, Mobile, Desktop)

---

## CORE CONCEPTS

PocketBase is a **stateless** backend. There are no sessions—authentication is via JWT tokens sent in `Authorization` headers. Superusers (`_superusers` collection) bypass all API rules and can access everything.

### Architecture

- **Collections** = database tables
- **Records** = rows in a table
- **Fields** = columns with typed values
- **API Rules** = per-collection access control filters
- **Hooks** = event-driven custom logic (Go or JS)

---

## COLLECTIONS & FIELDS

### Collection Types

| Type | Description |
|------|-------------|
| **Base** | Default. Store any data (articles, products, etc.) |
| **View** | Read-only. Data from SQL SELECT statement (aggregations, joins) |
| **Auth** | Base + special auth fields (email, password, verified, tokenKey, emailVisibility) |

### System Collections

- `_superusers` - Admin/superuser accounts (auth collection)
- `_mfas` - Multi-factor authentication sessions
- `_otps` - One-time passwords
- `_externalAuths` - OAuth2 external auth records

### Field Types

| Type | Zero Value | Description |
|------|-----------|-------------|
| `text` | `""` | String. Supports `:autogenerate` modifier |
| `number` | `0` | Float64. Supports `+`/`-` modifiers |
| `bool` | `false` | Boolean |
| `email` | `""` | Email string |
| `url` | `""` | URL string |
| `editor` | `""` | HTML content |
| `date` | `""` | DateTime string `Y-m-d H:i:s.uZ` |
| `autodate` | auto | Auto-set on create/update |
| `select` | `""`/`[]` | Single or multiple from predefined list. `+`/`-` modifiers |
| `file` | `""`/`[]` | File upload(s). `+`/`-` modifiers |
| `relation` | `""`/`[]` | Reference to other records. `+`/`-` modifiers |
| `json` | `null` | Any serialized JSON (nullable) |
| `geoPoint` | `{"lon":0,"lat":0}` | Geographic coordinates |
| `password` | (hidden) | Auth collection system field |

**Important**: All fields (except `json`) are non-nullable with zero defaults. Single select/file/relation stores a string; multiple (MaxSelect >= 2) stores an array.

### Field Modifiers (for create/update)

- `fieldName+` - Append value(s) to existing (for number: add; for select/file/relation: append)
- `+fieldName` - Prepend value(s) to existing (for select/file/relation)
- `fieldName-` - Subtract/remove value(s) from existing
- `fieldName:autogenerate` - Auto-generate value using pattern (for text fields)

---

## AUTHENTICATION

### Auth Methods

1. **Password** - Email/username + password (`POST /api/collections/{collection}/auth-with-password`)
2. **OAuth2** - Google, GitHub, Microsoft, Apple, Facebook, etc. (`POST /api/collections/{collection}/auth-with-oauth2`)
3. **OTP** - One-time password via email (`POST /api/collections/{collection}/request-otp` then `auth-with-otp`)
4. **MFA** - Multi-factor: requires 2 different auth methods in sequence
5. **TOF** - Tencent Open Framework gateway authentication (plugin-based)

### Auth Flow

```javascript
// Password auth
const authData = await pb.collection("users").authWithPassword("email@example.com", "password");
console.log(pb.authStore.token);    // JWT token
console.log(pb.authStore.record);   // Auth record data

// OAuth2 (all-in-one, recommended)
const authData = await pb.collection("users").authWithOAuth2({ provider: "google" });

// OTP
const result = await pb.collection("users").requestOTP("email@example.com");
const authData = await pb.collection("users").authWithOTP(result.otpId, "CODE");

// MFA flow
try {
  await pb.collection("users").authWithPassword("email", "pass");
} catch (err) {
  const mfaId = err.response?.mfaId;
  if (mfaId) {
    const result = await pb.collection("users").requestOTP("email");
    await pb.collection("users").authWithOTP(result.otpId, "CODE", { mfaId });
  }
}

// Logout
pb.authStore.clear();

// Auth refresh (validate existing token)
const authData = await pb.collection("users").authRefresh();
```

### Impersonation & API Keys

Superusers can impersonate any user:
```javascript
const impersonateClient = await pb.collection("users").impersonate("USER_ID", 3600);
```

For server-to-server "API keys", use a superuser impersonate token (non-renewable). Handle with extreme care.

### Other Auth Endpoints

- `POST /api/collections/{collection}/request-verification` - Send email verification
- `POST /api/collections/{collection}/confirm-verification` - Confirm verification
- `POST /api/collections/{collection}/request-password-reset` - Send password reset
- `POST /api/collections/{collection}/confirm-password-reset` - Confirm password reset
- `POST /api/collections/{collection}/request-email-change` - Request email change
- `POST /api/collections/{collection}/confirm-email-change` - Confirm email change

---

## API RULES & FILTERS

### Rule Types (per collection)

| Rule | Controls |
|------|----------|
| `listRule` | Who can list records |
| `viewRule` | Who can view a single record |
| `createRule` | Who can create records |
| `updateRule` | Who can update records |
| `deleteRule` | Who can delete records |
| `manageRule` | (Auth only) Who can fully manage another user's data |

### Rule Values

- `null` (locked) - Superuser only (default)
- `""` (empty string) - Anyone (including guests)
- `"expression"` - Only requests satisfying the filter expression

**Rules also act as data filters**: `listRule` returns only matching records; `viewRule/updateRule/deleteRule` return 404 if not satisfied.

### Filter Syntax

Format: `OPERAND OPERATOR OPERAND`

**Operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `~` (like), `!~` (not like), `?=` (any equal), `?!=`, `?>`, `?>=`, `?<`, `?<=`, `?~`, `?!~`

**Logical**: `&&` (AND), `||` (OR), `()` (grouping)

**Available Fields in Rules**:
- Collection schema fields (including nested relations: `someRelField.status`)
- `@request.auth.*` - Current authenticated user
- `@request.body.*` - Submitted body data
- `@request.query.*` - Query parameters
- `@request.headers.*` - Request headers (normalized: lowercase, `-` → `_`)
- `@request.method` - HTTP method
- `@request.context` - Context (default, oauth2, otp, password, realtime, protectedFile)
- `@collection.otherCollection.*` - Cross-collection reference

**Modifiers**: `:isset`, `:changed`, `:length`, `:each`, `:lower`

**Date Macros**: `@now`, `@second`, `@minute`, `@hour`, `@weekday`, `@day`, `@month`, `@year`, `@yesterday`, `@tomorrow`, `@todayStart`, `@todayEnd`, `@monthStart`, `@monthEnd`, `@yearStart`, `@yearEnd`

**Functions**:
- `geoDistance(lonA, latA, lonB, latB)` - Haversine distance in km
- `strftime(format, [time-value, modifiers...])` - Date formatting

### Examples

```
@request.auth.id != ""                                           // Logged-in users only
@request.auth.id != "" && (status = "active" || status = "pending")  // Logged-in + filter
@request.auth.role = "staff"                                      // Role-based
author = @request.auth.id                                         // Ownership
@request.body.role:isset = false                                  // Prevent field submission
@request.body.role:changed = false                                // Prevent field change
someRelField:length > 1                                           // Array length check
title:lower ~ "test"                                              // Case-insensitive search
geoDistance(address.lon, address.lat, 23.32, 42.69) < 25         // Geo distance
```

---

## RECORDS API

### CRUD Operations

```
GET    /api/collections/{collection}/records          # List (paginated, filterable, sortable)
GET    /api/collections/{collection}/records/{id}     # View single
POST   /api/collections/{collection}/records          # Create
PATCH  /api/collections/{collection}/records/{id}     # Update
DELETE /api/collections/{collection}/records/{id}     # Delete
POST   /api/batch                                      # Batch operations (transactional)
```

### Query Parameters

| Param | Description |
|-------|-------------|
| `page` | Page number (default: 1) |
| `perPage` | Records per page (default: 30) |
| `sort` | ORDER BY fields. `-` prefix = DESC. e.g. `-created,id` |
| `filter` | Filter expression. e.g. `(title~'abc' && created>'2022-01-01')` |
| `expand` | Expand relations. e.g. `relField1,relField2.subRelField` (up to 6 levels) |
| `fields` | Return specific fields. `*` = all at depth level. Supports `:excerpt(maxLen,ellipsis?)` |
| `skipTotal` | Skip total count query (faster pagination) |

### SDK Usage

```javascript
// List with pagination
const result = await pb.collection("posts").getList(1, 50, {
    filter: 'status = "active"',
    sort: '-created',
    expand: 'author,tags',
});

// Get all records
const records = await pb.collection("posts").getFullList({ sort: '-created' });

// Get first matching
const record = await pb.collection("posts").getFirstListItem('slug="hello"');

// Get by ID
const record = await pb.collection("posts").getOne("RECORD_ID");

// Create
const record = await pb.collection("posts").create({ title: "Hello", status: "draft" });

// Update
const record = await pb.collection("posts").update("RECORD_ID", { title: "Updated" });

// Delete
await pb.collection("posts").delete("RECORD_ID");

// Batch operations (transactional)
const batch = pb.createBatch();
batch.collection("example1").create({ ... });
batch.collection("example2").update("ID", { ... });
batch.collection("example3").delete("ID");
batch.collection("example4").upsert({ ... });
const result = await batch.send();
```

---

## REALTIME API

Implemented via Server-Sent Events (SSE). Events: `create`, `update`, `delete`.

- Subscribe to **single record**: collection's `ViewRule` applies
- Subscribe to **entire collection**: collection's `ListRule` applies

```javascript
// Subscribe to all changes in a collection
pb.collection("example").subscribe("*", (e) => {
    console.log(e.action); // "create", "update", or "delete"
    console.log(e.record);
});

// Subscribe to specific record
pb.collection("example").subscribe("RECORD_ID", (e) => { ... });

// Unsubscribe
pb.collection("example").unsubscribe("RECORD_ID");
pb.collection("example").unsubscribe("*");
pb.collection("example").unsubscribe(); // all
```

SSE auto-reconnects. Server disconnects idle connections after 5 minutes (auto re-established if client is active).

---

## FILES HANDLING

### Upload

Files are uploaded via `multipart/form-data` on record create/update. Each file gets a random suffix (e.g. `test_52iwbgds7l.png`).

```javascript
// Create record with files
const record = await pb.collection("example").create({
    title: "Hello",
    documents: [new File(["content"], "file1.txt"), new File(["content"], "file2.txt")],
});

// Append files to existing record
await pb.collection("example").update("RECORD_ID", { "documents+": new File(["..."], "file3.txt") });
```

### Delete Files

```javascript
await pb.collection("example").update("RECORD_ID", { documents: [] });           // Delete all
await pb.collection("example").update("RECORD_ID", { "documents-": ["file1.txt"] }); // Delete specific
```

### File URL

```
http://127.0.0.1:8090/api/files/{collection}/{recordId}/{filename}
http://127.0.0.1:8090/api/files/{collection}/{recordId}/{filename}?thumb=100x300
```

**Thumb formats**: `WxH` (crop center), `WxHt` (crop top), `WxHb` (crop bottom), `WxHf` (fit), `0xH` (resize height), `Wx0` (resize width)

### Protected Files

Mark file field as "Protected" → requires a short-lived file token:

```javascript
const fileToken = await pb.files.getToken();
const url = pb.files.getURL(record, filename, { token: fileToken });
```

### Storage

Default: local `pb_data/storage`. Optional: S3-compatible storage (AWS S3, MinIO, etc.) configured via Dashboard > Settings > Files storage.

---

## WORKING WITH RELATIONS

### Expand Relations

Use `expand` query parameter: `?expand=user,post.tags` (up to 6 levels depth)

### Back-Relations

Reference collections that point TO the current one: `referenceCollection_via_relField`

```javascript
// Get posts with their comments expanded (comments.post -> posts)
await pb.collection("posts").getList(1, 30, {
    filter: 'comments_via_post.message ?~ "hello"',
    expand: "comments_via_post.user",
});
```

Back-relations are treated as multiple by default. Limited to 1000 records per relation in expand.

---

## POSTGRESQL SUPPORT

This fork adds PostgreSQL as an alternative database backend alongside SQLite.

### Quick Start

```bash
# Via command line
./pocketbase serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"

# Via environment variable
export PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"
./pocketbase serve
```

**Priority**: Command line `--pg` > Environment variable `PB_POSTGRES_DSN` > Default (SQLite)

### Requirements

- PostgreSQL 15 or 16 recommended (14 limited, 13 and below not supported)
- Optional: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` for fuzzy search

### Connection String

```
postgres://user:password@host:port/dbname?sslmode=disable&connect_timeout=10
```

**SSL Modes**: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`

### Connection Pool

```bash
./pocketbase serve --pg="..." --dataMaxOpenConns=100 --dataMaxIdleConns=25
```

In PostgreSQL mode, auxiliary DB shares the main pool (`auxMaxOpenConns`/`auxMaxIdleConns` are ignored).

### PostgreSQL-Specific Features

- **JSONB** for JSON fields with GIN index acceleration
- **Row Level Security (RLS)** support
- **Full Text Search** via native PostgreSQL
- **FOR UPDATE SKIP LOCKED** for job queue task fetching

### Go Configuration

```go
app := pocketbase.NewWithConfig(pocketbase.Config{
    DefaultPostgresDSN: "postgres://user:pass@localhost:5432/pocketbase?sslmode=disable",
    DataMaxOpenConns:   100,
    DataMaxIdleConns:   25,
})
```

---

## SECRETS MANAGEMENT

Plugin-based encrypted secrets storage using AES-256-GCM.

### Setup

```bash
# Generate and set master key (64 hex chars = 32 bytes)
export PB_MASTER_KEY=$(openssl rand -hex 32)
```

```go
import "github.com/pocketbase/pocketbase/plugins/secrets"

secrets.MustRegister(app, secrets.DefaultConfig())
```

### Usage

```go
store := secrets.GetStore(app)
store.Set("STRIPE_API_KEY", "sk_live_xxx", secrets.WithDescription("Stripe key"))
apiKey, err := store.Get("STRIPE_API_KEY")
dbPass := store.GetWithDefault("DB_PASSWORD", "default_password")

// Environment isolation
store.Set("API_KEY", "dev_key", secrets.WithEnv("dev"))
store.Set("API_KEY", "prod_key", secrets.WithEnv("prod"))
key, _ := store.GetForEnv("API_KEY", "prod") // Returns "prod_key"
```

### REST API (Superuser only)

```
POST   /api/secrets          # Create/update secret
GET    /api/secrets           # List (masked values)
GET    /api/secrets/{key}     # Get plaintext
PUT    /api/secrets/{key}     # Update
DELETE /api/secrets/{key}     # Delete
```

---

## JOBS QUEUE

Plugin-based lightweight job queue with delayed tasks, auto-retry, concurrent processing.

### Setup

```go
import "github.com/pocketbase/pocketbase/plugins/jobs"

jobs.MustRegister(app, jobs.DefaultConfig())

// Register handler after bootstrap
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    if err := e.Next(); err != nil { return err }
    store := jobs.GetJobStore(app)
    store.Register("send_email", func(job *jobs.Job) error {
        var payload struct { To, Subject string }
        job.UnmarshalPayload(&payload)
        // ... send email
        return nil
    })
    return nil
})
```

### Enqueue Tasks

```go
store := jobs.GetJobStore(app)
job, _ := store.Enqueue("send_email", map[string]any{"to": "user@example.com"})
job, _ := store.EnqueueAt("send_email", payload, time.Now().Add(10*time.Minute))
job, _ := store.EnqueueWithOptions("send_email", payload, &jobs.JobEnqueueOptions{
    RunAt: time.Now().Add(1*time.Hour), MaxRetries: 5,
})
```

### Configuration

Key env vars: `PB_JOBS_WORKERS` (default 10), `PB_JOBS_POLL_INTERVAL` (1s), `PB_JOBS_LOCK_DURATION` (5m), `PB_JOBS_BATCH_SIZE` (10)

### REST API (Superuser only)

```
POST   /api/jobs/enqueue       # Enqueue task
GET    /api/jobs               # List tasks (?topic=...&status=...)
GET    /api/jobs/{id}          # Get single task
GET    /api/jobs/stats         # Get statistics
POST   /api/jobs/{id}/requeue  # Requeue failed task
DELETE /api/jobs/{id}          # Delete task
```

**Statuses**: `pending`, `processing`, `completed`, `failed`

Retry uses exponential backoff: 1min, 4min, 9min, ...

---

## PROXY GATEWAY

Built-in API proxy via `_proxies` system collection. Reuses PocketBase auth and rules.

### Configuration (via `_proxies` collection)

| Field | Description |
|-------|-------------|
| `path` | Proxy path prefix (use `/-/` prefix, e.g. `/-/openai`) |
| `upstream` | Upstream service URL |
| `stripPath` | Remove matched prefix (default `true`) |
| `accessRule` | PocketBase rule syntax (empty = superuser only, `"true"` = public) |
| `headers` | JSON header template to inject |
| `timeout` | Request timeout in seconds (default 30) |
| `active` | Enable/disable |

### Header Templates

```json
{
    "Authorization": "Bearer {env.OPENAI_API_KEY}",
    "X-User-Id": "@request.auth.id",
    "X-Custom": "static-value",
    "X-Secret": "{secret.API_KEY}"
}
```

### Example: OpenAI Proxy

```json
{
    "path": "/-/openai",
    "upstream": "https://api.openai.com",
    "stripPath": true,
    "accessRule": "@request.auth.id != ''",
    "headers": { "Authorization": "Bearer {env.OPENAI_API_KEY}" },
    "timeout": 120
}
```

```javascript
const response = await pb.send("/-/openai/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "Hello" }] }),
});
```

**Forbidden paths**: `/api/*`, `/_/*`

---

## PROCESS MANAGER

Plugin for managing sidecar processes (Python agents, Node.js workers, etc.).

### Setup

```go
import "github.com/pocketbase/pocketbase/plugins/processman"

processman.MustRegister(app, processman.Config{
    ConfigFile: "pb_processes.json",
})
```

### Configuration (`pb_processes.json`)

```json
[{
    "id": "ai-agent",
    "script": "agent.py",
    "cwd": "./agents",
    "env": { "OPENAI_API_KEY": "${OPENAI_API_KEY}" },
    "maxRetries": 10,
    "backoff": "1s",
    "devMode": true,
    "watchPaths": ["./src"]
}]
```

Features: auto-restart, exponential backoff (max 30s), Python venv auto-detection, log bridging, dev mode hot reload (500ms debounce).

### REST API (Superuser only)

```
GET  /api/pm/list             # List processes
POST /api/pm/{id}/restart     # Restart process
POST /api/pm/{id}/stop        # Stop process
```

---

## CLI REFERENCE

### Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--dir` | Data directory | `./pb_data` |
| `--dev` | Dev mode | `false` |
| `--pg` | PostgreSQL DSN | (none, uses SQLite) |
| `--encryptionEnv` | Env var for settings encryption key (32 chars) | (none) |
| `--queryTimeout` | Default SELECT timeout (seconds) | `30` |
| `--dataMaxOpenConns` | Main DB max connections | `100` |
| `--dataMaxIdleConns` | Main DB max idle connections | `20` |

### Commands

```bash
./pocketbase serve [domain(s)] [--http=addr] [--https=addr] [--origins=list]
./pocketbase superuser create|upsert|update|delete|otp EMAIL [PASS]
./pocketbase migrate up|down|create|collections|history-sync
```

---

## EXTENDING WITH GO

### Minimal Example

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
            return e.String(200, "Hello "+e.Request.PathValue("name"))
        })
        return se.Next()
    })

    if err := app.Start(); err != nil { log.Fatal(err) }
}
```

Build: `go mod init myapp && go mod tidy && go build`

### Event Hooks (Go)

Hooks follow the pattern `app.OnEventName("optionalCollectionFilter").BindFunc(handler)`. Call `e.Next()` to continue the chain.

Common hooks:
- `app.OnServe()` - Server start, register routes
- `app.OnBootstrap()` - App initialization
- `app.OnRecordCreateRequest("collection")` - Before/during record create API request
- `app.OnRecordUpdateRequest("collection")` - Before/during record update API request
- `app.OnRecordDeleteRequest("collection")` - Before/during record delete API request
- `app.OnRecordCreate("collection")` / `app.OnRecordCreateExecute()` - Record create lifecycle
- `app.OnRecordUpdate("collection")` / `app.OnRecordUpdateExecute()` - Record update lifecycle
- `app.OnRecordDelete("collection")` / `app.OnRecordDeleteExecute()` - Record delete lifecycle
- `app.OnRecordEnrich("collection")` - Before record serialization (hide/unhide fields)
- `app.OnRecordAfterCreateSuccess()` / `app.OnRecordAfterUpdateSuccess()` - After successful save

### Custom Console Commands

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use: "hello",
    Run: func(cmd *cobra.Command, args []string) { fmt.Println("Hello!") },
})
```

---

## EXTENDING WITH JAVASCRIPT

Place `*.pb.js` files in `pb_hooks` directory. Auto-reloads on change (UNIX).

### Example

```javascript
/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/hello/{name}", (e) => {
    let name = e.request.pathValue("name")
    return e.json(200, { message: "Hello " + name })
})

onRecordCreateRequest((e) => {
    if (!e.hasSuperuserAuth()) {
        e.record.set("status", "pending")
    }
    e.next()
}, "posts")
```

### Key Differences from Go

- Method/field names use camelCase: `app.FindRecordById()` → `$app.findRecordById()`
- Errors are thrown as exceptions (not returned)
- Global objects: `$app`, `$apis`, `$os`, `$security`, `__hooks`
- Each handler runs in isolated context (no shared outer variables)
- Use `require()` for modules (CommonJS only, no ESM natively)
- Pool of 15 JS runtimes (adjustable via `--hooksPool=N`)

### Caveats

- ES5 engine (goja) with most ES6 features but not fully spec compliant
- No `setTimeout`/`setInterval` inside handlers
- No Node.js/browser APIs (no `window`, `fs`, `fetch`, `buffer`)
- Relative paths are from CWD, use `__hooks` for absolute hooks path

---

## GO DATABASE OPERATIONS

### Raw Queries

```go
// Execute (no return data)
app.DB().NewQuery("DELETE FROM articles WHERE status = 'archived'").Execute()

// Single row
user := User{}
app.DB().NewQuery("SELECT * FROM users WHERE id=1").One(&user)

// Multiple rows
users := []User{}
app.DB().NewQuery("SELECT * FROM users LIMIT 100").All(&users)

// Bind parameters (prevent SQL injection)
app.DB().NewQuery("SELECT * FROM posts WHERE created >= {:from}").
    Bind(dbx.Params{"from": "2023-06-25"}).All(&posts)
```

### Query Builder

```go
app.DB().
    Select("id", "email").
    From("users").
    InnerJoin("profiles", dbx.NewExp("profiles.user_id = users.id")).
    AndWhere(dbx.Like("email", "example.com")).
    AndWhere(dbx.HashExp{"status": "active"}).
    OrderBy("created ASC").
    Limit(100).
    Offset(0).
    All(&results)
```

**Expressions**: `dbx.NewExp()`, `dbx.HashExp{}`, `dbx.Not()`, `dbx.And()`, `dbx.Or()`, `dbx.In()`, `dbx.NotIn()`, `dbx.Like()`, `dbx.NotLike()`, `dbx.Between()`, `dbx.Exists()`, `dbx.NotExists()`

### Transactions

```go
app.RunInTransaction(func(txApp core.App) error {
    record, _ := txApp.FindRecordById("articles", "ID")
    record.Set("status", "active")
    txApp.Save(record) // Always use txApp inside transaction!
    return nil          // nil = commit, error = rollback
})
```

---

## GO RECORD OPERATIONS

### Fetch Records

```go
// Single record
record, err := app.FindRecordById("articles", "RECORD_ID")
record, err := app.FindFirstRecordByData("articles", "slug", "test")
record, err := app.FindFirstRecordByFilter("articles", "status = {:s}", dbx.Params{"s": "active"})

// Multiple records
records, err := app.FindRecordsByIds("articles", []string{"ID1", "ID2"})
records, err := app.FindRecordsByFilter("articles", "status = 'active'", "-created", 10, 0)
records, err := app.FindAllRecords("articles", dbx.HashExp{"status": "pending"})
count, err := app.CountRecords("articles", dbx.HashExp{"status": "pending"})

// Auth records
user, err := app.FindAuthRecordByEmail("users", "test@example.com")
user, err := app.FindAuthRecordByToken("TOKEN", core.TokenTypeAuth)
```

### Create/Update/Delete

```go
// Create
collection, _ := app.FindCollectionByNameOrId("articles")
record := core.NewRecord(collection)
record.Set("title", "Hello")
app.Save(record)

// Update
record, _ := app.FindRecordById("articles", "ID")
record.Set("title", "Updated")
app.Save(record)

// Delete
app.Delete(record)
```

### Record Field Access

```go
record.Get("field")              // any
record.GetString("field")       // string
record.GetBool("field")         // bool
record.GetInt("field")          // int
record.GetFloat("field")        // float64
record.GetDateTime("field")     // types.DateTime
record.GetStringSlice("field")  // []string
record.Set("field", value)
record.Set("field+", value)     // append modifier

record.ExpandedOne("author")     // *core.Record
record.ExpandedAll("categories") // []*core.Record
record.PublicExport()            // map[string]any
```

### Auth Record Helpers

```go
record.Email() / record.SetEmail(email)
record.Verified() / record.SetVerified(bool)
record.ValidatePassword(pass) / record.SetPassword(pass)
record.NewAuthToken() / record.NewVerificationToken() / record.NewPasswordResetToken()
record.IsSuperuser()
```

### Expand Relations Programmatically

```go
app.ExpandRecord(record, []string{"author", "categories"}, nil)
author := record.ExpandedOne("author")
cats := record.ExpandedAll("categories")
```

---

## GO ROUTING

### Register Routes

```go
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
        return e.String(200, "Hello "+e.Request.PathValue("name"))
    })

    // With middleware
    se.Router.POST("/api/myapp/data", handler).Bind(apis.RequireAuth())

    // Groups
    g := se.Router.Group("/api/myapp")
    g.Bind(apis.RequireAuth())
    g.GET("/items", listAction)
    g.POST("/items", createAction)

    return se.Next()
})
```

### Path Patterns

- `/hello/{name}` - Named parameter
- `/static/{path...}` - Wildcard (multiple segments)
- `/exact/{$}` - End-of-URL marker
- Trailing `/` acts as anonymous wildcard

### Request Helpers

```go
e.Request.PathValue("id")          // Path param
e.Request.URL.Query().Get("search") // Query param
e.Request.Header.Get("X-Token")     // Header
e.Auth                               // Current auth record (nil = guest)
e.HasSuperuserAuth()                 // Is superuser?
e.RemoteIP() / e.RealIP()           // Client IP
e.BindBody(&struct{})               // Parse request body
e.FindUploadedFiles("document")     // Get uploaded files
```

### Response Helpers

```go
e.JSON(200, data)                // JSON response
e.String(200, "text")            // Plain text
e.HTML(200, "<h1>Hello</h1>")   // HTML
e.Redirect(307, "https://...")   // Redirect
e.NoContent(204)                 // No body
e.FileFS(fsys, "file.txt")      // Serve file
e.Stream(200, contentType, reader) // Stream
```

### Error Responses

```go
e.BadRequestError("msg", nil)       // 400
e.UnauthorizedError("msg", nil)     // 401
e.ForbiddenError("msg", nil)        // 403
e.NotFoundError("msg", nil)         // 404
e.TooManyRequestsError("msg", nil)  // 429
e.InternalServerError("msg", nil)   // 500
```

### Built-in Middlewares

```go
apis.RequireAuth(optCollectionNames...)    // Require authenticated user
apis.RequireSuperuserAuth()                // Require superuser
apis.RequireGuestOnly()                    // Require unauthenticated
apis.RequireSuperuserOrOwnerAuth("id")     // Superuser or record owner
apis.BodyLimit(limitBytes)                 // Custom body size limit
apis.Gzip()                                // Gzip compression
apis.SkipSuccessActivityLog()              // Skip logging successful requests
```

---

## SETTINGS API

Superuser only.

```
GET   /api/settings                              # List all settings
PATCH /api/settings                              # Update settings
POST  /api/settings/test/s3                      # Test S3 connection
POST  /api/settings/test/email                   # Test email
POST  /api/settings/apple/generate-client-secret # Generate Apple OAuth secret
```

**Setting Groups**: `meta` (app name, URL), `smtp` (mail server), `s3` (file storage), `backups` (backup S3), `logs` (retention, level), `batch` (batch API), `rateLimits`, `trustedProxy`

---

## BACKUPS API

Superuser only.

```
GET    /api/backups                    # List backups
POST   /api/backups                    # Create backup
POST   /api/backups/upload             # Upload backup
GET    /api/backups/{key}              # Download backup
POST   /api/backups/{key}/restore      # Restore from backup (restarts server)
DELETE /api/backups/{key}              # Delete backup
```

Backups are ZIP archives of `pb_data`. During generation, app is temporarily read-only.

---

## LOGS & HEALTH API

### Health Check (public)

```
GET /api/health → { "status": 200, "message": "API is healthy.", "data": { "canBackup": true } }
```

### Logs (Superuser only)

```
GET /api/logs                          # List logs (paginated, filterable)
GET /api/logs/{id}                     # View single log
GET /api/logs/stats                    # Hourly aggregated statistics
```

Filter logs by: `level`, `message`, `data.status`, `data.method`, `data.url`, `data.auth`, etc.

### Crons (Superuser only)

```
GET  /api/crons                        # List registered cron jobs
POST /api/crons/{jobId}                # Manually trigger a cron job
```

---

## GOING TO PRODUCTION

### Deployment

1. **Minimal**: Upload binary + `pb_migrations` + `pb_hooks` → `./pocketbase serve yourdomain.com` (auto TLS)
2. **Systemd service**: Create `/lib/systemd/system/pocketbase.service` with `ExecStart=/path/pocketbase serve yourdomain.com`
3. **Reverse proxy**: Nginx/Caddy in front. Set `proxy_read_timeout 360s` and proxy headers (`X-Real-IP`, `X-Forwarded-For`)
4. **Docker**: Alpine-based with mounted `/pb/pb_data` volume

### Production Checklist

- ✅ **Use SMTP** for email delivery (avoid `sendmail`)
- ✅ **Enable MFA for superusers** (OTP + password)
- ✅ **Enable rate limiter** (Dashboard > Settings > Application)
- ⚡ Increase open file descriptors: `ulimit -n 4096`
- ⚡ Set `GOMEMLIMIT` for memory-constrained environments
- 🔒 Enable settings encryption: `--encryptionEnv=PB_ENCRYPTION_KEY` (32-char random key)
- 🔒 For PostgreSQL: use SSL (`sslmode=require`), set up regular pg_dump backups

### Backup

- **SQLite**: Copy `pb_data` directory (stop app first for safety), or use built-in backup API
- **PostgreSQL**: Use `pg_dump` for database, still need `pb_data` for uploaded files

---

## COLLECTIONS API (Superuser only)

```
GET    /api/collections                            # List collections
GET    /api/collections/{idOrName}                 # View collection
POST   /api/collections                            # Create collection
PATCH  /api/collections/{idOrName}                 # Update collection
DELETE /api/collections/{idOrName}                 # Delete collection
DELETE /api/collections/{idOrName}/truncate         # Truncate (delete all records)
PUT    /api/collections/import                      # Bulk import collections
GET    /api/collections/meta/scaffolds             # Get collection type scaffolds
```

### Collection Schema (Create/Update Body)

```json
{
    "name": "posts",
    "type": "base",
    "fields": [
        { "name": "title", "type": "text", "required": true, "min": 10 },
        { "name": "status", "type": "select", "values": ["draft", "published"] },
        { "name": "author", "type": "relation", "collectionId": "users_collection_id" }
    ],
    "indexes": ["CREATE INDEX idx_title ON posts (title)"],
    "listRule": "@request.auth.id != ''",
    "viewRule": "",
    "createRule": "@request.auth.id != ''",
    "updateRule": "author = @request.auth.id",
    "deleteRule": "author = @request.auth.id"
}
```

For **auth collections**, additional options: `passwordAuth`, `oauth2`, `mfa`, `otp`, `manageRule`, `authRule`, token durations, email templates.

For **view collections**: `viewQuery` (SQL SELECT statement), fields auto-generated.

---

## MIGRATIONS

### JavaScript Migrations (in `pb_migrations/`)

Auto-generated when modifying collections in Dashboard. Can also be created manually.

### CLI

```bash
./pocketbase migrate up                    # Run pending migrations
./pocketbase migrate down 1                # Revert last migration
./pocketbase migrate create add_posts      # Create blank migration
./pocketbase migrate collections           # Snapshot all collections
./pocketbase migrate history-sync          # Clean deleted migration references
```

### Pre-deployment Workflow

1. `./pocketbase migrate collections` (create snapshot)
2. Delete auto-generated `*_created.js`, `*_updated.js`, `*_deleted.js` files (keep seed migrations)
3. `./pocketbase migrate history-sync`
4. `./pocketbase migrate up` (verify)

---

## KEY DIFFERENCES FROM UPSTREAM POCKETBASE

This fork extends the original PocketBase with:

1. **PostgreSQL support** - Use `--pg` flag or `PB_POSTGRES_DSN` env var
2. **Secrets Management** - Encrypted key-value store via `plugins/secrets`
3. **Jobs Queue** - Persistent task queue with retry via `plugins/jobs`
4. **Proxy Gateway** - Built-in API proxy via `_proxies` collection
5. **Process Manager** - Sidecar process management via `plugins/processman`
6. **TOF Authentication** - Tencent Open Framework auth via `plugins/tofauth`
7. **Analytics** - Analytics capabilities via Go extensions
8. **3-Layer Crypto Architecture** - Core crypto provider + SecretField + Secrets plugin

All new features follow the **plugin architecture** (opt-in registration). The original SQLite functionality remains fully intact and is the default.
