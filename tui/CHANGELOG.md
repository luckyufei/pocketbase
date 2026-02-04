# Changelog

All notable changes to PocketBase TUI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-03

### Added

- **Core Infrastructure**
  - React + Ink v5 based TUI framework
  - Jotai state management
  - Commander.js CLI interface
  - TypeScript strict mode support

- **Omni-Bar**
  - Command palette with `/command @resource` syntax
  - Command autocomplete with Tab
  - Resource selection with `@collection` syntax
  - Parameter parsing (filter, sort, page, perPage)

- **Collections Module**
  - `/cols` - List all collections with type and record count
  - `/schema @col` - View collection schema with field details
  - Keyboard navigation (↑/↓/Enter)

- **Records Module**
  - `/view @col` - View records in table format
  - `/get @col:id` - View single record details
  - Filter support (`filter="field=value"`)
  - Sort support (`sort="-created"`)
  - Pagination (Page Up/Down, page=N)

- **Logs Module**
  - `/logs` - Real-time log stream
  - Level filtering (`level=error`)
  - Color-coded log levels
  - Auto-scroll with timestamp display

- **Monitoring Module**
  - `/monitor` - System metrics dashboard
  - CPU usage, memory, goroutines, connections
  - Real-time refresh

- **Connection Module**
  - `--url` parameter for server URL
  - `--token` parameter for auth token
  - Environment variables (POCKETBASE_URL, POCKETBASE_TOKEN)
  - Auto-reconnect on network issues

- **General Commands**
  - `/help [command]` - Show help
  - `/health` - Server health check
  - `/clear` - Clear screen
  - `/quit` (alias `/q`) - Exit TUI

- **Keyboard Shortcuts**
  - `Esc` - Return to previous level
  - `r` - Refresh current view
  - `?` - Show shortcuts help
  - `Ctrl+C` - Exit
  - Page Up/Down - Pagination
  - Home/End - Jump to first/last

- **Edge Case Handling**
  - Empty input ignored
  - Network disconnect recovery
  - Terminal size validation (80x24 minimum)
  - Large dataset pagination
  - Special character escaping
  - Token expiration handling

### Technical

- 600+ unit and acceptance tests
- 95%+ code coverage
- Bun 1.1+ compatibility
- TypeScript strict mode
- Performance thresholds met:
  - First render < 500ms
  - OmniBar response < 50ms
  - Command execution < 100ms
  - Memory usage < 100MB

### Supported Terminals

- iTerm2
- Windows Terminal
- GNOME Terminal
- Terminal.app (macOS)
- VS Code Terminal
- Hyper
- WezTerm
- Konsole

## [Unreleased]

### Planned

- Write operations (create, update, delete)
- Admin authentication UI
- AI-assisted features (Phase 2)
- Multiple server connections
- Settings persistence
