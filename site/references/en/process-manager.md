# Process Manager

The Process Manager plugin provides native sidecar process management capabilities for PocketBase, supporting launching, monitoring, and managing external processes (such as Python AI Agents, Node.js services, etc.).

## Features

- **Process Lifecycle Management** - Automatically manage child processes with PocketBase startup/shutdown
- **Keep-Alive Guardian** - Auto-restart after process crash
- **Exponential Backoff** - Prevent flapping (infinite fast restarts), max 30 seconds
- **Python Venv Auto-Detection** - Smart detection of `.venv` or `venv` virtual environments
- **Log Bridging** - Child process stdout/stderr output to PocketBase logs
- **Environment Variable Injection** - Support `${VAR}` template syntax
- **Declarative Configuration** - Define processes via `pb_processes.json` config file
- **REST API** - Query status, restart, stop processes
- **Dev Mode Hot Reload** - Auto-restart on file changes (500ms debounce)

## Quick Start

### 1. Create Configuration File

Create `pb_processes.json` in PocketBase data directory (default `pb_data`):

```json
[
  {
    "id": "ai-agent",
    "script": "agent.py",
    "cwd": "./agents",
    "env": {
      "OPENAI_API_KEY": "${OPENAI_API_KEY}"
    },
    "maxRetries": 10,
    "backoff": "1s",
    "devMode": true,
    "watchPaths": ["./src"]
  }
]
```

### 2. Register Plugin

Register the plugin in your `main.go`:

```go
package main

import (
    "log"
    
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/processman"
)

func main() {
    app := pocketbase.New()
    
    // Register process manager plugin
    processman.MustRegister(app, processman.Config{
        ConfigFile: "pb_processes.json", // Optional, default value
    })
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 3. Run PocketBase

```bash
# Production mode
./pocketbase serve

# Development mode (auto-enable hot reload)
./pocketbase serve --dev

# Specify config file
./pocketbase serve --pmConfig=./my-processes.json
```

All configured processes will start automatically with PocketBase.

## Configuration Reference

### pb_processes.json Format

```json
[
  {
    "id": "string",           // Required: unique process identifier
    "script": "string",       // Script path (either script or command)
    "command": "string",      // Direct command (either script or command)
    "args": ["string"],       // Command arguments
    "cwd": "string",          // Required: working directory
    "env": {                  // Environment variables (supports ${VAR} template)
      "KEY": "value"
    },
    "interpreter": "string",  // Interpreter path, "auto" for auto-detection
    "maxRetries": 10,         // Max retry count, -1 for infinite
    "backoff": "1s",          // Retry interval base
    "devMode": false,         // Dev mode (enable hot reload)
    "watchPaths": ["./src"]   // Hot reload watch paths
  }
]
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | ✅ | - | Unique process identifier |
| `script` | string | ❌ | - | Script file path (either script or command) |
| `command` | string | ❌ | - | Direct command to execute (either script or command) |
| `args` | []string | ❌ | [] | Command line arguments |
| `cwd` | string | ✅ | - | Working directory (supports relative paths) |
| `env` | map | ❌ | {} | Environment variables, supports `${VAR}` template syntax |
| `interpreter` | string | ❌ | "auto" | Interpreter path, "auto" for auto-detection |
| `maxRetries` | int | ❌ | 10 | Max retry count, -1 for infinite |
| `backoff` | string | ❌ | "1s" | Retry interval base time |
| `devMode` | bool | ❌ | false | Dev mode, enable file watch hot reload |
| `watchPaths` | []string | ❌ | [] | Hot reload watch paths |

### Environment Variables

The plugin automatically injects these environment variables:

| Variable | Description |
|----------|-------------|
| `PB_PORT` | PocketBase listening port |
| `PB_DATA_DIR` | PocketBase data directory |

User-configured environment variables support `${VAR}` template syntax, auto-expanded from system environment variables.

### Python Venv Auto-Detection

When `interpreter` is set to `"auto"` or not set, the plugin detects Python interpreter in this order:

1. `{cwd}/.venv/bin/python` (preferred)
2. `{cwd}/venv/bin/python`
3. `python3` (system default)

## REST API

::: warning Note
All Process Manager APIs require Superuser privileges.
:::

### Get Process List

```http
GET /api/pm/list
```

**Response Example:**

```json
[
  {
    "id": "ai-agent",
    "pid": 4021,
    "status": "running",
    "startTime": "2026-01-30T10:00:00Z",
    "uptime": "2h30m15s",
    "restartCount": 3,
    "lastError": ""
  }
]
```

### Process Status Description

| Status | Description |
|--------|-------------|
| `running` | Process is running |
| `stopped` | Process is stopped |
| `failed` | Process failed (max retries reached) |
| `starting` | Process is starting |

### Restart Process

```http
POST /api/pm/{id}/restart
```

**Response Example:**

```json
{
  "message": "Process restart initiated",
  "id": "ai-agent"
}
```

### Stop Process

```http
POST /api/pm/{id}/stop
```

**Response Example:**

```json
{
  "message": "Process stopped",
  "id": "ai-agent"
}
```

## Code Configuration

Besides JSON config file, you can also register processes via code:

```go
pm := processman.New(app, processman.Config{})

pm.Register(processman.ProcessConfig{
    ID:         "my-agent",
    Script:     "agent.py",
    Cwd:        "./agents",
    MaxRetries: -1, // Infinite retries
    Env: map[string]string{
        "API_KEY": os.Getenv("API_KEY"),
    },
})

pm.Start()
```

## Usage Examples

### Python AI Agent

```json
[
  {
    "id": "openai-agent",
    "script": "agent.py",
    "args": ["--model", "gpt-4"],
    "cwd": "./agents/openai",
    "env": {
      "OPENAI_API_KEY": "${OPENAI_API_KEY}",
      "PB_API_URL": "http://localhost:8090/api"
    },
    "interpreter": "auto",
    "maxRetries": 10,
    "backoff": "2s",
    "devMode": true,
    "watchPaths": ["./src", "./config"]
  }
]
```

### Node.js Service

```json
[
  {
    "id": "node-worker",
    "command": "node",
    "args": ["--experimental-modules", "worker.mjs"],
    "cwd": "./workers",
    "env": {
      "NODE_ENV": "production"
    },
    "maxRetries": 5
  }
]
```

### Multi-Process Configuration

```json
[
  {
    "id": "agent-1",
    "script": "agent.py",
    "args": ["--port", "8091"],
    "cwd": "./agents"
  },
  {
    "id": "agent-2",
    "script": "agent.py",
    "args": ["--port", "8092"],
    "cwd": "./agents"
  },
  {
    "id": "worker",
    "command": "python3",
    "args": ["-m", "celery", "worker"],
    "cwd": "./workers"
  }
]
```

## Behavior Details

### Exponential Backoff Strategy

When a process crashes consecutively, restart interval grows exponentially:

```
1st crash: restart after 1s
2nd crash: restart after 2s
3rd crash: restart after 4s
4th crash: restart after 8s
5th crash: restart after 16s
6th and beyond: restart after 30s (cap)
```

If a process runs for more than **10 seconds** before crashing, it's considered "healthy running" and the backoff counter resets to 0.

### Process Group Cleanup

The plugin uses `Setpgid` to create process groups, ensuring the entire process tree (including grandchild processes) is cleaned up on termination.

### Hot Reload Debounce

In dev mode, file change triggered restarts have a **500ms** debounce time to avoid multiple triggers on save.

## Best Practices

### 1. Use Virtual Environments

For Python projects, using virtual environments is recommended:

```bash
cd ./agents
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The plugin will automatically detect and use the Python interpreter from `.venv`.

### 2. Set Appropriate Retry Counts

```json
// For critical services, use infinite retries
{
  "id": "critical-service",
  "maxRetries": -1
}

// For optional services, limit retry count
{
  "id": "optional-service",
  "maxRetries": 3
}
```

### 3. Dev Mode Hot Reload

Start PocketBase with `--dev` in development environment, all processes auto-enable hot reload:

```bash
./pocketbase serve --dev
```

Or enable individually in config:

```json
{
  "id": "my-agent",
  "devMode": true,
  "watchPaths": ["./src", "./config"]
}
```

### 4. Log Viewing

Child process stdout and stderr output to PocketBase logs:

- **stdout** → Info level
- **stderr** → Error level

Use PocketBase's logging system to view process output.

## Notes

1. **Windows Compatibility**: Process signals may behave differently on Windows
2. **Config File Paths**: Relative paths are resolved based on PocketBase data directory
3. **maxRetries=-1**: Means infinite retries, process will never be abandoned
4. **Log Levels**: stdout outputs at Info level, stderr outputs at Error level
5. **Process Isolation**: Each process runs in its own process group for easy cleanup
