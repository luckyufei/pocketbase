# Secrets Management

PocketBase provides secure secrets management for storing sensitive information such as API keys and database passwords. All secrets are encrypted using AES-256-GCM.

## Features

- **AES-256-GCM Encryption** - Industry-standard encryption algorithm
- **Environment Isolation** - Manage secrets by environment (dev/staging/prod)
- **Fallback Mechanism** - Automatically falls back to global when specified environment doesn't exist
- **Masked Display** - List API doesn't expose plaintext values
- **RESTful API** - Complete CRUD interface
- **Dual Database Compatibility** - Supports both SQLite and PostgreSQL
- **Plugin Architecture** - Optional registration, enable as needed

## Enabling Secrets

Secrets functionality is provided as a plugin and requires two steps:

### 1. Set Master Key

```bash
# Generate a secure Master Key (64 hex characters = 32 bytes)
openssl rand -hex 32

# Set environment variable
export PB_MASTER_KEY="your-64-character-hex-string-here"
```

::: danger Important
Master Key must be 64 hexadecimal characters (32 bytes / 256 bits). Keep it safe - losing it will make stored secrets unrecoverable.
:::

### 2. Register Plugin

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // Register secrets plugin
    secrets.MustRegister(app, secrets.DefaultConfig())
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Quick Start

### Go SDK

```go
package main

import (
    "log"
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/plugins/secrets"
)

func main() {
    app := pocketbase.New()
    
    // Register secrets plugin
    secrets.MustRegister(app, secrets.DefaultConfig())

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // Get secrets store
        store := secrets.GetStore(app)

        // Check if feature is enabled
        if !store.IsEnabled() {
            log.Println("Secrets feature not enabled, please set PB_MASTER_KEY")
            return se.Next()
        }

        // Store secret
        err := store.Set("STRIPE_API_KEY", "sk_live_xxx", 
            secrets.WithDescription("Stripe production API key"))
        if err != nil {
            log.Printf("Storage failed: %v", err)
        }

        // Read secret
        apiKey, err := store.Get("STRIPE_API_KEY")
        if err != nil {
            log.Printf("Read failed: %v", err)
        } else {
            log.Printf("API Key: %s", apiKey)
        }

        // Read with default value
        dbPassword := store.GetWithDefault("DB_PASSWORD", "default_password")
        log.Printf("DB Password: %s", dbPassword)

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Environment Isolation

```go
store := secrets.GetStore(app)

// Store to specific environment
store.Set("API_KEY", "dev_key", secrets.WithEnv("dev"))
store.Set("API_KEY", "prod_key", secrets.WithEnv("prod"))
store.Set("API_KEY", "global_key")  // Default stores to "global"

// Read from specific environment (with fallback)
key, _ := store.GetForEnv("API_KEY", "prod")  // Returns "prod_key"
key, _ := store.GetForEnv("API_KEY", "test")  // Returns "global_key" (fallback)
```

## API Endpoints

::: warning Note
All Secrets APIs require Superuser privileges, and Secrets feature must be enabled.
:::

### Create/Update Secret

```http
POST /api/secrets
Content-Type: application/json

{
    "key": "STRIPE_API_KEY",
    "value": "sk_live_xxx",
    "env": "prod",           // Optional, defaults to "global"
    "description": "Stripe production API key"  // Optional
}
```

**Response:**
```json
{
    "key": "STRIPE_API_KEY",
    "env": "prod",
    "message": "Secret created successfully"
}
```

### Get Secret List

```http
GET /api/secrets
```

**Response:**
```json
{
    "items": [
        {
            "id": "abc123",
            "key": "STRIPE_API_KEY",
            "masked_value": "U2FsdG***",
            "env": "prod",
            "description": "Stripe production API key",
            "created": "2025-01-08T10:00:00Z",
            "updated": "2025-01-08T10:00:00Z"
        }
    ],
    "total": 1
}
```

::: info Tip
List API returns masked values (`masked_value`), not exposing plaintext.
:::

### Get Secret Plaintext

```http
GET /api/secrets/{key}
```

**Response:**
```json
{
    "key": "STRIPE_API_KEY",
    "value": "sk_live_xxx"
}
```

### Update Secret

```http
PUT /api/secrets/{key}
Content-Type: application/json

{
    "value": "sk_live_new_xxx",
    "description": "Updated description"
}
```

### Delete Secret

```http
DELETE /api/secrets/{key}
```

**Response:** `204 No Content`

## Configuration Options

### Code Configuration

```go
secrets.Config{
    // Enable environment isolation (default true)
    EnableEnvIsolation: true,
    
    // Default environment (default "global")
    DefaultEnv: "global",
    
    // Maximum key length (default 256)
    MaxKeyLength: 256,
    
    // Maximum value size (default 4KB)
    MaxValueSize: 4 * 1024,
    
    // Enable HTTP API (default true)
    HTTPEnabled: true,
}
```

### Environment Variable Overrides

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `PB_MASTER_KEY` | Encryption key (required, 64 hex chars) | `0123456789abcdef...` |
| `PB_SECRETS_DEFAULT_ENV` | Default environment | `prod` |
| `PB_SECRETS_MAX_KEY_LENGTH` | Maximum key length | `512` |
| `PB_SECRETS_MAX_VALUE_SIZE` | Maximum value size (bytes) | `8192` |
| `PB_SECRETS_HTTP_ENABLED` | Enable HTTP API | `true` |
| `PB_SECRETS_ENV_ISOLATION` | Enable environment isolation | `true` |

## Error Handling

| Error | Description |
|-------|-------------|
| `ErrSecretsNotRegistered` | Secrets plugin not registered |
| `ErrCryptoNotEnabled` | Crypto feature not enabled (Master Key not set) |
| `ErrSecretNotFound` | Secret not found |
| `ErrSecretKeyEmpty` | Key is empty |
| `ErrSecretKeyTooLong` | Key exceeds maximum length |
| `ErrSecretValueTooLarge` | Value exceeds maximum size |

## 3-Layer Crypto Architecture

Secrets Plugin is **Layer 3** in PocketBase's 3-layer crypto architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: plugins/secrets/                                   │
│    System-level secret management (_secrets table, API)      │
│    Uses app.Crypto() from Layer 1 for encryption            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: core/field_secret.go                               │
│    User-level SecretField (Collection field)                 │
│    Uses app.Crypto() from Layer 1 for encryption            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: core/crypto.go                                     │
│    CryptoProvider - Shared encryption engine (AES-256-GCM)  │
│    app.Crypto() - Provided by App interface                 │
└─────────────────────────────────────────────────────────────┘
```

### Layer Description

| Layer | Location | Purpose | Access Method |
|-------|----------|---------|---------------|
| Layer 1 | `core/crypto.go` | Low-level encryption engine | `app.Crypto()` |
| Layer 2 | `core/field_secret.go` | Collection encrypted field | Schema definition |
| Layer 3 | `plugins/secrets/` | System-level secret storage | `secrets.GetStore(app)` |

## Gateway Integration

Secrets can be used with the Gateway plugin for automatic API key injection:

```go
// Reference Secret in Gateway config
{
    "headers": {
        "Authorization": "Bearer {secret.OPENAI_API_KEY}"
    }
}
```

Gateway automatically reads encrypted API Keys from `_secrets` table and injects them into request headers.

## Database Schema

```sql
CREATE TABLE _secrets (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,          -- AES-256-GCM encrypted value
    env TEXT NOT NULL DEFAULT 'global',
    description TEXT,
    created TIMESTAMP NOT NULL,
    updated TIMESTAMP NOT NULL,
    UNIQUE(key, env)
);
```

## Security Best Practices

### 1. Master Key Management

```bash
# Generate a secure Master Key
openssl rand -hex 32

# Do not commit Master Key to code repository
# Use environment variables or secret management services (e.g., HashiCorp Vault, AWS KMS)
```

### 2. Access Control

Secrets API is restricted to superusers only. Ensure:
- Use strong passwords to protect superuser accounts
- Enable two-factor authentication (if available)
- Regularly rotate superuser passwords

### 3. Secret Rotation

```go
store := secrets.GetStore(app)

// Regularly update secrets
store.Set("API_KEY", newKey, secrets.WithDescription("2025-01 rotation"))

// Old secrets are automatically overwritten (UPSERT)
```

### 4. Environment Isolation

```go
store := secrets.GetStore(app)

// Use test keys for development environment
store.Set("STRIPE_KEY", "sk_test_xxx", secrets.WithEnv("dev"))

// Use real keys for production environment
store.Set("STRIPE_KEY", "sk_live_xxx", secrets.WithEnv("prod"))
```

## Encryption Details

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Nonce**: 12-byte random number (generated fresh for each encryption)
- **Storage Format**: Base64 encoded `nonce + ciphertext + tag`

## Database Compatibility

Secrets module is fully compatible with SQLite and PostgreSQL:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Time Function | `datetime('now')` | `NOW()` |
| UPSERT | `ON CONFLICT DO UPDATE` | `ON CONFLICT DO UPDATE` |
| Unique Constraint | `UNIQUE(key, env)` | `UNIQUE(key, env)` |

No code changes needed - the system automatically adapts to different databases.

## Migration from Old Version

If you were using the `app.Secrets()` API (old version), follow these steps to migrate:

### 1. Update Imports

```go
// Old version
import "github.com/pocketbase/pocketbase/core"

// New version
import "github.com/pocketbase/pocketbase/plugins/secrets"
```

### 2. Register Plugin

```go
// Add before app.Start()
secrets.MustRegister(app, secrets.DefaultConfig())
```

### 3. Update API Calls

```go
// Old version
secrets := app.Secrets()
secrets.Set("KEY", "value", core.WithDescription("desc"))

// New version
store := secrets.GetStore(app)
store.Set("KEY", "value", secrets.WithDescription("desc"))
```

### 4. Update Option References

```go
// Old version
core.WithDescription("desc")
core.WithEnv("prod")

// New version
secrets.WithDescription("desc")
secrets.WithEnv("prod")
```
