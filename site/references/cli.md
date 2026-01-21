# Command Line Interface (CLI)

PocketBase provides a set of CLI commands to manage your application. You can view all available commands by running:

```bash
./pocketbase --help
```

## Global Flags

These flags are available for all commands:

| Flag | Description | Default |
|------|-------------|---------|
| `--dir` | The PocketBase data directory | `./pb_data` |
| `--encryptionEnv` | Environment variable name whose value (32 characters) will be used as encryption key for app settings | (none) |
| `--dev` | Enable dev mode (prints logs and SQL statements to console) | `false` (auto-enabled when using `go run`) |
| `--queryTimeout` | Default SELECT queries timeout in seconds | `30` |
| `--pg` | PostgreSQL connection string. When set, PocketBase uses PostgreSQL instead of SQLite | (none) |
| `--dataMaxOpenConns` | Maximum number of open connections to the main database | `100` |
| `--dataMaxIdleConns` | Maximum number of idle connections to the main database | `20` |
| `--auxMaxOpenConns` | Maximum number of open connections to the auxiliary database (SQLite only) | `4` |
| `--auxMaxIdleConns` | Maximum number of idle connections to the auxiliary database (SQLite only) | `2` |

## serve

Starts the web server.

```bash
./pocketbase serve [domain(s)] [flags]
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--http` | TCP address to listen for HTTP server | `127.0.0.1:8090` (or `0.0.0.0:80` if domain specified) |
| `--https` | TCP address to listen for HTTPS server | (empty, or `0.0.0.0:443` if domain specified) |
| `--origins` | CORS allowed domain origins list | `*` |

### Examples

```bash
# Start with default settings (localhost:8090)
./pocketbase serve

# Start with custom HTTP address
./pocketbase serve --http="0.0.0.0:8080"

# Start with auto TLS for specific domains
./pocketbase serve yourdomain.com www.yourdomain.com

# Start with custom origins for CORS
./pocketbase serve --origins="https://example.com,https://app.example.com"

# Start in dev mode with SQL logging
./pocketbase serve --dev

# Start with PostgreSQL backend
./pocketbase serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"
```

## superuser

Manage superuser accounts. This command has several subcommands.

### superuser create

Creates a new superuser account.

```bash
./pocketbase superuser create EMAIL PASSWORD
```

**Example:**
```bash
./pocketbase superuser create admin@example.com MySecurePassword123
```

### superuser upsert

Creates a new superuser or updates the password if the email already exists.

```bash
./pocketbase superuser upsert EMAIL PASSWORD
```

**Example:**
```bash
./pocketbase superuser upsert admin@example.com NewPassword456
```

### superuser update

Changes the password of an existing superuser.

```bash
./pocketbase superuser update EMAIL PASSWORD
```

**Example:**
```bash
./pocketbase superuser update admin@example.com UpdatedPassword789
```

### superuser delete

Deletes an existing superuser account.

```bash
./pocketbase superuser delete EMAIL
```

**Example:**
```bash
./pocketbase superuser delete admin@example.com
```

### superuser otp

Generates a new OTP (One-Time Password) for a superuser. OTP authentication must be enabled for the `_superusers` collection.

```bash
./pocketbase superuser otp EMAIL
```

**Example:**
```bash
./pocketbase superuser otp admin@example.com
# Output:
# Successfully created OTP for superuser "admin@example.com":
# ├─ Id:    abc123xyz
# ├─ Pass:  847291
# └─ Valid: 300s
```

## migrate

::: info Note
The `migrate` command is available when using PocketBase as a framework with the `migratecmd` plugin registered.
:::

Executes database migration scripts.

```bash
./pocketbase migrate [command] [flags]
```

### Subcommands

| Command | Description |
|---------|-------------|
| `up` | Runs all available migrations |
| `down [number]` | Reverts the last `[number]` applied migrations |
| `create name` | Creates a new blank migration template file |
| `collections` | Creates a new migration file with a snapshot of all collections |
| `history-sync` | Ensures the `_migrations` history table doesn't have references to deleted migration files |

### Examples

```bash
# Run all pending migrations
./pocketbase migrate up

# Revert the last migration
./pocketbase migrate down 1

# Revert the last 3 migrations
./pocketbase migrate down 3

# Create a new migration file
./pocketbase migrate create add_posts_collection

# Create a snapshot of all collections
./pocketbase migrate collections
```

### Pre-deployment Best Practice

Before deploying to production, it's recommended to clean up your local migrations folder. During development, auto-migration creates many incremental `*_created.js`, `*_updated.js`, and `*_deleted.js` files. These can be consolidated into a single snapshot for cleaner deployments.

**Recommended workflow:**

1. **Sync database state to local migrations folder**
   ```bash
   # Create a snapshot of all current collections
   ./pocketbase migrate collections
   ```

2. **Clean up incremental migration files**
   
   Delete all auto-generated migration files (those ending with `_created.js`, `_updated.js`, `_deleted.js`) but **keep your seed migrations** (e.g., `*_seed_*.js`, or any custom migrations that insert initial data).
   
   ```bash
   # Example: Remove auto-generated migrations (adjust pattern as needed)
   rm pb_migrations/*_created.js
   rm pb_migrations/*_updated.js
   rm pb_migrations/*_deleted.js
   ```

3. **Sync migration history**
   ```bash
   # Remove references to deleted migration files from _migrations table
   ./pocketbase migrate history-sync
   ```

4. **Verify migrations**
   ```bash
   # Ensure all migrations run successfully
   ./pocketbase migrate up
   ```

::: tip Why keep seed migrations?
Seed migrations contain initial data (e.g., default categories, admin users, configuration records) that should be applied when setting up a fresh database. Unlike schema migrations which can be regenerated via `migrate collections`, seed data needs to be preserved.
:::

::: warning
Always backup your database before cleaning up migrations. Test the migration process on a fresh database to ensure nothing is broken.
:::

## Environment Variables

PocketBase also supports configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `PB_POSTGRES_DSN` | PostgreSQL connection string (alternative to `--pg` flag) |

**Example:**
```bash
PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/pocketbase" ./pocketbase serve
```

## Examples

### Development Setup

```bash
# Run with dev mode enabled
./pocketbase serve --dev

# Or using go run (dev mode auto-enabled)
go run main.go serve
```

### Production Setup with TLS

```bash
# Auto-obtain TLS certificates via Let's Encrypt
./pocketbase serve yourdomain.com --http="0.0.0.0:80" --https="0.0.0.0:443"
```

### Using PostgreSQL

```bash
# Via command line flag
./pocketbase serve --pg="postgres://user:password@localhost:5432/pocketbase?sslmode=disable"

# Via environment variable
export PB_POSTGRES_DSN="postgres://user:password@localhost:5432/pocketbase?sslmode=disable"
./pocketbase serve
```

### Custom Data Directory

```bash
# Store data in a custom location
./pocketbase serve --dir="/var/lib/pocketbase"
```

### Encrypted Settings

```bash
# Use an encryption key from environment variable
export PB_ENCRYPTION_KEY="12345678901234567890123456789012"
./pocketbase serve --encryptionEnv="PB_ENCRYPTION_KEY"
```
