# Secrets Management

PocketBase provides secure secrets management for storing sensitive information such as API keys and database passwords. All secrets are encrypted using AES-256-GCM.

## Features

- **AES-256-GCM Encryption** - Industry-standard encryption algorithm
- **Environment Isolation** - Manage secrets by environment (dev/staging/prod)
- **Fallback Mechanism** - Automatically falls back to global when specified environment doesn't exist
- **Masked Display** - List API doesn't expose plaintext values
- **RESTful API** - Complete CRUD interface
- **Dual Database Compatibility** - Supports both SQLite and PostgreSQL

## Enabling Secrets

Secrets functionality requires setting a Master Key to enable:

```bash
# Method 1: Environment variable
export PB_MASTER_KEY="your-32-byte-master-key-here!!"
./pocketbase serve

# Method 2: Command line argument
./pocketbase serve --masterKey="your-32-byte-master-key-here!!"
```

::: danger Important
Master Key must be 32 bytes (256 bits), used to derive encryption keys. Keep it safe - losing it will make stored secrets unrecoverable.
:::

## Quick Start

### Go SDK

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
        secrets := app.Secrets()

        // Check if feature is enabled
        if !secrets.IsEnabled() {
            log.Println("Secrets feature not enabled, please set PB_MASTER_KEY")
            return se.Next()
        }

        // Store secret
        err := secrets.Set("STRIPE_API_KEY", "sk_live_xxx", 
            core.WithDescription("Stripe production API key"))
        if err != nil {
            log.Printf("Storage failed: %v", err)
        }

        // Read secret
        apiKey, err := secrets.Get("STRIPE_API_KEY")
        if err != nil {
            log.Printf("Read failed: %v", err)
        } else {
            log.Printf("API Key: %s", apiKey)
        }

        // Read with default value
        dbPassword := secrets.GetWithDefault("DB_PASSWORD", "default_password")

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Environment Isolation

```go
// Store to specific environment
secrets.Set("API_KEY", "dev_key", core.WithEnv("dev"))
secrets.Set("API_KEY", "prod_key", core.WithEnv("prod"))
secrets.Set("API_KEY", "global_key")  // Default stores to "global"

// Read from specific environment (with fallback)
key, _ := secrets.GetForEnv("API_KEY", "prod")  // Returns "prod_key"
key, _ := secrets.GetForEnv("API_KEY", "test")  // Returns "global_key" (fallback)
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

## Configuration Parameters

| Constant | Default | Description |
|----------|---------|-------------|
| `SecretMaxKeyLength` | 256 | Maximum key length |
| `SecretMaxValueSize` | 4 KB | Maximum value size |
| `SecretDefaultEnv` | "global" | Default environment |

## Error Handling

| Error | Description |
|-------|-------------|
| `ErrSecretsDisabled` | Secrets feature not enabled (Master Key not set) |
| `ErrSecretNotFound` | Secret not found |
| `ErrSecretKeyEmpty` | Key is empty |
| `ErrSecretKeyTooLong` | Key exceeds 256 characters |
| `ErrSecretValueTooLarge` | Value exceeds 4KB |

## UI Management

In PocketBase Admin UI, navigate to **Settings → Secrets** to:

- View all secrets (masked display)
- Create new secrets
- Update secret values and descriptions
- Delete secrets
- Filter by environment

## Security Best Practices

### 1. Master Key Management

```bash
# Generate a secure Master Key
openssl rand -base64 32 | tr -d '\n' | head -c 32

# Do not commit Master Key to code repository
# Use environment variables or secret management services
```

### 2. Access Control

Secrets API is restricted to superusers only. Ensure:
- Use strong passwords to protect superuser accounts
- Enable two-factor authentication (if available)
- Regularly rotate superuser passwords

### 3. Secret Rotation

```go
// Regularly update secrets
secrets.Set("API_KEY", newKey, core.WithDescription("2025-01 rotation"))

// Old secrets are automatically overwritten (UPSERT)
```

### 4. Environment Isolation

```go
// Use test keys for development environment
secrets.Set("STRIPE_KEY", "sk_test_xxx", core.WithEnv("dev"))

// Use real keys for production environment
secrets.Set("STRIPE_KEY", "sk_live_xxx", core.WithEnv("prod"))
```

## Encryption Details

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 (SHA-256, 100,000 iterations)
- **Nonce**: 12-byte random number
- **Storage Format**: Base64 encoded `nonce + ciphertext + tag`

## Database Compatibility

Secrets module is fully compatible with SQLite and PostgreSQL:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Time Function | `datetime('now')` | `NOW()` |
| UPSERT | `ON CONFLICT DO UPDATE` | `ON CONFLICT DO UPDATE` |
| Unique Constraint | `UNIQUE(key, env)` | `UNIQUE(key, env)` |

No code changes needed - the system automatically adapts to different databases.
