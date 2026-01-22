# PostgreSQL Guide

This document explains how to use PostgreSQL as the database backend in PocketBase.

## Quick Start

### 1. Prepare PostgreSQL Database

```bash
# Quick start PostgreSQL with Docker
docker run -d \
  --name pocketbase-postgres \
  -e POSTGRES_USER=pocketbase \
  -e POSTGRES_PASSWORD=pocketbase \
  -e POSTGRES_DB=pocketbase \
  -p 5432:5432 \
  postgres:16
```

### 2. Start PocketBase

```bash
# Method 1: Command line argument
./pocketbase serve --pg="postgres://pocketbase:pocketbase@localhost:5432/pocketbase?sslmode=disable"

# Method 2: Environment variable
export PB_POSTGRES_DSN="postgres://pocketbase:pocketbase@localhost:5432/pocketbase?sslmode=disable"
./pocketbase serve
```

### 3. Access Admin Interface

Open browser and visit `http://localhost:8090/_/` to create admin account.

## System Requirements

### PostgreSQL Version

| Version | Support Status | Notes |
|---------|----------------|-------|
| PostgreSQL 16 | ✅ Recommended | Latest stable, full feature support |
| PostgreSQL 15 | ✅ Supported | Full feature support |
| PostgreSQL 14 | ⚠️ Limited | Basic features available, some advanced features unavailable |
| PostgreSQL 13 and below | ❌ Not Supported | Missing required JSONB functions |

### Required Extensions

```sql
-- pg_trgm extension for fuzzy search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Configuration Methods

### Command Line Argument

```bash
./pocketbase serve --pg="postgres://user:password@host:port/dbname?sslmode=disable"
```

### Environment Variable

```bash
# Set PostgreSQL connection string
export PB_POSTGRES_DSN="postgres://user:password@host:port/dbname?sslmode=disable"

# Start service
./pocketbase serve
```

### Priority

Command line argument > Environment variable > Default (SQLite)

## Connection String Format

### Standard URI Format

```
postgres://[user[:password]@][host][:port][/dbname][?param1=value1&...]
```

### Examples

```bash
# Basic connection
postgres://user:password@localhost:5432/pocketbase

# Disable SSL (development)
postgres://user:password@localhost:5432/pocketbase?sslmode=disable

# Enable SSL (production)
postgres://user:password@db.example.com:5432/pocketbase?sslmode=require

# Full configuration
postgres://user:password@localhost:5432/pocketbase?sslmode=disable&connect_timeout=10&application_name=pocketbase
```

### Connection Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `sslmode` | SSL connection mode | `prefer` |
| `connect_timeout` | Connection timeout (seconds) | Unlimited |
| `application_name` | Application name | `pocketbase` |
| `timezone` | Timezone setting | `UTC` |

### SSL Modes

| Mode | Description |
|------|-------------|
| `disable` | Disable SSL |
| `allow` | Prefer non-SSL, try SSL on failure |
| `prefer` | Prefer SSL, try non-SSL on failure |
| `require` | Require SSL |
| `verify-ca` | Verify server certificate |
| `verify-full` | Verify server certificate and hostname |

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    container_name: pocketbase-postgres
    environment:
      POSTGRES_USER: pocketbase
      POSTGRES_PASSWORD: pocketbase
      POSTGRES_DB: pocketbase
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pocketbase"]
      interval: 10s
      timeout: 5s
      retries: 5

  pocketbase:
    image: pocketbase/pocketbase:latest
    container_name: pocketbase
    environment:
      PB_POSTGRES_DSN: postgres://pocketbase:pocketbase@postgres:5432/pocketbase?sslmode=disable
    ports:
      - "8090:8090"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - pocketbase_data:/pb_data

volumes:
  postgres_data:
  pocketbase_data:
```

### Start Services

```bash
docker-compose up -d
```

## Connection Pool Configuration

### Architecture Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Main Database | `data.db` file | Same database |
| Auxiliary Database | `auxiliary.db` file | Shares main database connection |
| Connection Pools | 4 (main+aux, each with concurrent/non-concurrent) | 2 (shared pool) |

**PostgreSQL Optimization**: Since all tables are in the same database, PostgreSQL mode automatically shares connection pools, reducing resource usage.

### Default Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dataMaxOpenConns` | 120 | Maximum open connections |
| `dataMaxIdleConns` | 15 | Maximum idle connections |
| `auxMaxOpenConns` | 20 | Auxiliary DB max open connections (SQLite only) |
| `auxMaxIdleConns` | 3 | Auxiliary DB max idle connections (SQLite only) |

### Command Line Configuration

```bash
# PostgreSQL mode - only configure main database pool
./pocketbase serve \
  --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable" \
  --dataMaxOpenConns=100 \
  --dataMaxIdleConns=25

# SQLite mode - can configure both main and auxiliary pools
./pocketbase serve \
  --dataMaxOpenConns=120 \
  --dataMaxIdleConns=15 \
  --auxMaxOpenConns=20 \
  --auxMaxIdleConns=3
```

::: info Note
In PostgreSQL mode, `--auxMaxOpenConns` and `--auxMaxIdleConns` parameters are ignored since auxiliary database shares main database connection pool.
:::

### Code Configuration

```go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DefaultPostgresDSN: "postgres://user:pass@localhost:5432/pocketbase?sslmode=disable",
        DataMaxOpenConns:   100,  // Maximum open connections
        DataMaxIdleConns:   25,   // Maximum idle connections
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Connection Pool Tuning Recommendations

| Scenario | dataMaxOpenConns | dataMaxIdleConns |
|----------|------------------|------------------|
| Low concurrency (< 100 QPS) | 25-50 | 5-10 |
| Medium concurrency (100-500 QPS) | 50-100 | 10-25 |
| High concurrency (> 500 QPS) | 100-200 | 25-50 |

::: warning Important
Ensure PostgreSQL server's `max_connections` is greater than `dataMaxOpenConns`.
:::

## PostgreSQL Features

### JSONB Support

PocketBase uses JSONB type in PostgreSQL to store JSON fields, supporting:

- Efficient JSON queries
- GIN index acceleration
- Partial updates

### GIN Index

Automatically creates GIN indexes for JSONB fields to optimize query performance:

```sql
-- Auto-created index example
CREATE INDEX idx_posts_data_gin ON posts USING GIN (data jsonb_path_ops);
```

### Row Level Security (RLS)

PostgreSQL version supports native RLS, configurable directly via SQL:

```sql
-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY posts_view ON posts FOR SELECT USING (true);
CREATE POLICY posts_owner ON posts FOR ALL USING (user_id = current_setting('pb.auth.id', true));
```

### Full Text Search

Leverage PostgreSQL native full text search:

```sql
-- Create full text search index
CREATE INDEX idx_posts_content_fts ON posts USING GIN (to_tsvector('english', content));
```

## Migration from SQLite

### Export SQLite Data

```bash
# Export data using pocketbase
./pocketbase export --output=backup.zip
```

### Import to PostgreSQL

```bash
# Start with PostgreSQL mode and import
./pocketbase serve --pg="postgres://..." --import=backup.zip
```

### Notes

1. **Data Type Differences**: SQLite's dynamic types auto-convert to PostgreSQL's strong types
2. **DateTime**: Ensure timezone settings are consistent (UTC recommended)
3. **Auto-increment ID**: SQLite's ROWID converts to PostgreSQL's SERIAL

## Performance Optimization

### 1. Connection Pool Tuning

Adjust pool size via command line:

```bash
# High concurrency scenario
./pocketbase serve --pg="postgres://..." --dataMaxOpenConns=100 --dataMaxIdleConns=25

# Low concurrency scenario
./pocketbase serve --pg="postgres://..." --dataMaxOpenConns=25 --dataMaxIdleConns=5
```

### 2. Index Optimization

Create indexes for frequently queried fields:

```sql
-- Create index for email field
CREATE INDEX idx_users_email ON users (email);

-- Create GIN index for JSONB field
CREATE INDEX idx_posts_tags ON posts USING GIN ((data->'tags'));
```

### 3. Query Optimization

Use EXPLAIN ANALYZE to analyze slow queries:

```sql
EXPLAIN ANALYZE SELECT * FROM posts WHERE data @> '{"status": "published"}';
```

### 4. Configuration Optimization

PostgreSQL server configuration recommendations:

```ini
# postgresql.conf
shared_buffers = 256MB          # 25% system memory
effective_cache_size = 768MB    # 75% system memory
work_mem = 16MB
maintenance_work_mem = 128MB
random_page_cost = 1.1          # SSD storage
```

## Troubleshooting

### Connection Failed

```
Error: PostgreSQL connection validation failed: dial tcp: connection refused
```

**Solution**:
1. Check if PostgreSQL service is running
2. Verify host and port are correct
3. Check firewall settings

### Authentication Failed

```
Error: password authentication failed for user "pocketbase"
```

**Solution**:
1. Verify username and password
2. Check `pg_hba.conf` authentication config
3. Ensure user has database access permissions

### SSL Error

```
Error: SSL is not enabled on the server
```

**Solution**:
- Development: Use `sslmode=disable`
- Production: Configure PostgreSQL SSL certificates

### Permission Denied

```
Error: permission denied for table xxx
```

**Solution**:
```sql
GRANT ALL PRIVILEGES ON DATABASE pocketbase TO pocketbase;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pocketbase;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pocketbase;
```

### Missing Extension

```
Error: function similarity does not exist
```

**Solution**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Important Notes

### 1. Backup Strategy

PostgreSQL requires independent backup strategy:

```bash
# Backup using pg_dump
pg_dump -U pocketbase -h localhost pocketbase > backup.sql

# Restore
psql -U pocketbase -h localhost pocketbase < backup.sql
```

### 2. Transaction Isolation

PostgreSQL defaults to `READ COMMITTED` isolation level, different from SQLite's `SERIALIZABLE`. High concurrency scenarios may need adjustment:

```sql
SET default_transaction_isolation = 'serializable';
```

### 3. Connection Limits

Note PostgreSQL's `max_connections` setting, ensure it's greater than application's pool size.

### 4. Data Directory

When using PostgreSQL, `pb_data` directory is still needed for:
- Uploaded files
- Backup files
- Cache data
- Configuration files

### 5. Version Compatibility

- Backup data before upgrading PostgreSQL version
- Recommend PostgreSQL 15 or 16 for best compatibility

### 6. Production Checklist

- [ ] Use SSL connection (`sslmode=require` or higher)
- [ ] Configure appropriate connection pool size
- [ ] Set up regular backup tasks
- [ ] Monitor database performance
- [ ] Configure logging
- [ ] Set connection timeout
- [ ] Use dedicated database user

## Related Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [PocketBase Official Documentation](https://pocketbase.io/docs/)
- [pgx Driver Documentation](https://github.com/jackc/pgx)
