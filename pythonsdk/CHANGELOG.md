# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-XX-XX

### Added

- Initial release of PocketBase Python SDK
- **Sync Client (`PocketBase`)**
  - Full CRUD operations for collections and records
  - Authentication support (password, OAuth2, OTP)
  - Realtime subscriptions via SSE
  - File uploads and downloads
  - Filter expression builder with parameter binding
  - Request hooks (before_send, after_send)
  - Auto request cancellation

- **Async Client (`AsyncPocketBase`)**
  - Async/await support for all operations
  - Context manager support
  - AsyncRecordService for async record operations

- **Services**
  - `RecordService` - Collection record CRUD
  - `CollectionService` - Collection management
  - `FileService` - File URL building and tokens
  - `RealtimeService` - SSE subscriptions
  - `HealthService` - API health checks
  - `SettingsService` - System settings
  - `LogService` - Log management
  - `BackupService` - Backup management
  - `CronService` - Cron job management
  - `BatchService` - Batch requests
  - `JobsService` - Background jobs
  - `SecretsService` - Encrypted secrets
  - `AnalyticsService` - Analytics tracking
  - `TraceService` - Distributed tracing

- **Auth Features**
  - Password authentication
  - OAuth2 code flow
  - OTP (one-time password)
  - Token refresh
  - Email verification
  - Password reset
  - Email change
  - User impersonation

- **Utilities**
  - `BaseAuthStore` - In-memory auth state management
  - JWT utilities (decode, check expiration)
  - Filter expression builder
  - `ClientResponseError` - Typed exception handling

- **Models**
  - `RecordModel` - Base record model
  - `ListResult[T]` - Paginated list result
  - `CollectionModel` - Collection schema model

### Dependencies

- `httpx>=0.25.0` - HTTP client
- `httpx-sse>=0.4.0` - SSE support
- `pydantic>=2.0.0` - Data validation

### Requirements

- Python 3.10+

[Unreleased]: https://github.com/pocketbase/pocketbase-python/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pocketbase/pocketbase-python/releases/tag/v0.1.0
