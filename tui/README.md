# PocketBase TUI

Terminal User Interface for PocketBase - Claude Code style

A powerful command-line interface for managing and exploring PocketBase instances, featuring an Omni-Bar for quick navigation, real-time logs, and system monitoring.

## Features

- 🖥️ **Omni-Bar** - Command palette with `/command` + `@resource` syntax
- 📊 **Collections** - Browse collections and view Schema details
- 📝 **Records** - View, filter, sort, and paginate records
- 📋 **Real-time Logs** - Stream logs with level filtering
- 📈 **System Monitor** - CPU, memory, goroutines dashboard
- ⌨️ **Keyboard Shortcuts** - Vim-like navigation
- 🔄 **Auto-reconnect** - Handles network disconnections gracefully

## Installation

```bash
# Using Bun (recommended)
bun install -g @pocketbase/tui

# Or run locally
cd tui
bun install
bun run dev
```

## Quick Start

```bash
# Connect to default server (http://127.0.0.1:8090)
pbtui

# Specify server URL
pbtui --url http://localhost:8090

# Use admin token
pbtui --token "your_admin_token"

# Using environment variables
export POCKETBASE_URL=http://localhost:8090
export POCKETBASE_TOKEN=your_token
pbtui
```

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/cols` | List all collections | `/cols` |
| `/view @col` | View records in a collection | `/view @users filter="verified=true"` |
| `/get @col:id` | Get a single record by ID | `/get @users:abc123` |
| `/schema @col` | View collection schema | `/schema @users` |
| `/logs` | View log stream | `/logs level=error` |
| `/monitor` | View system metrics | `/monitor` |
| `/health` | Check server health | `/health` |
| `/clear` | Clear the screen | `/clear` |
| `/help` | Show help | `/help view` |
| `/quit` | Exit TUI (alias: `/q`) | `/quit` |

### Filtering Records

```bash
# Filter by field
/view @users filter="verified=true"

# Date range filter
/view @posts filter="created>'2024-01-01'"

# Pagination
/view @users page=2 perPage=50

# Sorting
/view @posts sort="-created"
```

## Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `/` | Enter command mode |
| `@` | Enter resource selection |
| `Tab` | Autocomplete |
| `↑`/`↓` | Navigate list items |
| `←`/`→` | Navigate table columns |
| `Enter` | Confirm/Select |
| `Esc` | Cancel/Go back |
| `q` | Return to main view |

### Pagination

| Key | Action |
|-----|--------|
| `Page Up` | Previous page |
| `Page Down` | Next page |
| `Home` | Jump to first item |
| `End` | Jump to last item |

### Actions

| Key | Action |
|-----|--------|
| `r` | Refresh current view |
| `?` | Show shortcuts help |
| `Ctrl+C` | Exit TUI |

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test

# Run tests with coverage
bun test --coverage

# Type check
bun run typecheck

# Build for production
bun run build
```

### Project Structure

```
tui/
├── src/
│   ├── app.tsx              # Main application component
│   ├── cli.tsx              # CLI entry point
│   ├── features/            # Feature modules
│   │   ├── collections/     # Collections browser
│   │   ├── records/         # Records viewer
│   │   ├── logs/            # Logs stream
│   │   ├── monitoring/      # System monitor
│   │   ├── omnibar/         # Command palette
│   │   ├── connection/      # Connection management
│   │   ├── commands/        # General commands
│   │   ├── keyboard/        # Keyboard shortcuts
│   │   ├── edge-cases/      # Edge case handling
│   │   └── nfr/             # Non-functional requirements
│   ├── components/          # Shared components
│   ├── hooks/               # Custom hooks
│   ├── lib/                 # Utilities
│   └── store/               # Global state (Jotai)
└── tests/                   # Test files
```

### Testing

The project follows TDD (Test-Driven Development) methodology:

- **Unit tests**: Test individual functions and modules
- **Acceptance tests**: Test user stories and workflows
- **Coverage target**: ≥ 80% (current: 95%+)

```bash
# Run all tests
bun test

# Run specific module tests
bun test tests/features/logs/

# Run with coverage
bun test --coverage
```

## Requirements

- **Bun** 1.1+
- **Terminal**: 80x24 minimum size
- **Node.js** 18+ (for npm compatibility)

### Supported Terminals

- iTerm2
- Windows Terminal
- GNOME Terminal
- Terminal.app (macOS)
- VS Code Terminal
- Hyper
- WezTerm
- Konsole

## Tech Stack

- **Runtime**: Bun
- **UI Framework**: React + Ink v5
- **State Management**: Jotai
- **CLI**: Commander.js
- **API Client**: PocketBase JS SDK
- **Testing**: bun:test

## License

MIT
