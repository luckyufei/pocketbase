# Proxy Gateway

PocketBase has built-in API proxy gateway functionality (`_proxies`), allowing you to proxy external API requests to upstream services while reusing PocketBase's authentication and permission system.

## Features

- **Zero Configuration Deployment** - No additional Nginx/Traefik needed, single binary runs everything
- **Unified Authentication** - Reuse PocketBase's user authentication and Rule Engine
- **Key Protection** - Sensitive API Keys stored server-side, inaccessible to frontend
- **Header Injection** - Support dynamic injection of environment variables and user info into upstream requests
- **Hot Reload** - Configuration changes take effect immediately without restart

## Quick Start

### 1. Create Proxy Configuration

In Admin UI, navigate to `_proxies` system Collection, create a new record:

| Field | Value | Description |
|-------|-------|-------------|
| `path` | `/-/openai` | Proxy path prefix |
| `upstream` | `https://api.openai.com` | Upstream service address |
| `stripPath` | `true` | Remove matched path prefix |
| `accessRule` | `@request.auth.id != ''` | Require logged-in user |
| `headers` | `{"Authorization": "Bearer {env.OPENAI_API_KEY}"}` | Inject API Key |
| `timeout` | `60` | Timeout in seconds |
| `active` | `true` | Enable proxy |

### 2. Set Environment Variable

```bash
export OPENAI_API_KEY="sk-your-api-key"
```

### 3. Send Request

```bash
# Frontend request (requires PocketBase auth Token)
curl -X POST http://localhost:8090/-/openai/v1/chat/completions \
  -H "Authorization: Bearer <pb_auth_token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

The request will be proxied to `https://api.openai.com/v1/chat/completions`, with `Authorization: Bearer sk-your-api-key` header automatically injected.

## Configuration Fields

### `_proxies` Collection Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `path` | Text | ✅ | - | Proxy path prefix, must start with `/` |
| `upstream` | URL | ✅ | - | Upstream service URL |
| `stripPath` | Bool | ❌ | `true` | Whether to remove matched path prefix |
| `accessRule` | Text | ❌ | `""` | Access control rule |
| `headers` | JSON | ❌ | `{}` | Request header template to inject |
| `timeout` | Number | ❌ | `30` | Request timeout in seconds |
| `active` | Bool | ❌ | `true` | Whether enabled |

### Path Rules

#### Recommended Path Prefix

Use `/-/` prefix, which is reserved namespace for gateway:

```
/-/openai      → https://api.openai.com
/-/stripe      → https://api.stripe.com
/-/internal    → http://internal-service:3000
```

#### Forbidden Paths

The following paths are reserved and cannot be used for proxy:

- `/api/*` - PocketBase API routes
- `/_/*` - Admin UI routes

### `stripPath` Behavior

| `stripPath` | Request Path | Proxy Path | Upstream URL |
|-------------|--------------|------------|--------------|
| `true` | `/-/openai/v1/chat` | `/-/openai` | `https://api.openai.com/v1/chat` |
| `false` | `/-/openai/v1/chat` | `/-/openai` | `https://api.openai.com/-/openai/v1/chat` |

## Access Control

### Rule Syntax

`accessRule` uses the same syntax as PocketBase Collection Rules:

| Rule | Effect |
|------|--------|
| `""` (empty) | Superuser only |
| `"true"` | Public access (no auth required) |
| `@request.auth.id != ''` | Any logged-in user required |
| `@request.auth.verified = true` | Verified email user required |
| `@request.auth.role = 'admin'` | Specific role required (custom field) |

### Example Configurations

#### Admin Only Access

```json
{
  "path": "/-/admin-api",
  "upstream": "https://internal-admin.example.com",
  "accessRule": ""
}
```

#### Public API (No Auth Required)

```json
{
  "path": "/-/public",
  "upstream": "https://public-api.example.com",
  "accessRule": "true"
}
```

#### Logged-in User Access

```json
{
  "path": "/-/openai",
  "upstream": "https://api.openai.com",
  "accessRule": "@request.auth.id != ''"
}
```

#### VIP User Access

```json
{
  "path": "/-/premium",
  "upstream": "https://premium-api.example.com",
  "accessRule": "@request.auth.subscription = 'premium'"
}
```

## Request Header Injection

### Template Syntax

`headers` field supports the following template variables:

| Syntax | Description | Example |
|--------|-------------|---------|
| `{env.VAR_NAME}` | Environment variable | `{env.API_KEY}` |
| `@request.auth.id` | Current user ID | - |
| `@request.auth.email` | Current user email | - |
| `@request.auth.<field>` | Any field from user record | `@request.auth.name` |
| Static value | Use directly | `application/json` |

### Example Configurations

#### Inject API Key

```json
{
  "headers": {
    "Authorization": "Bearer {env.OPENAI_API_KEY}"
  }
}
```

#### Inject User Info

```json
{
  "headers": {
    "X-User-Id": "@request.auth.id",
    "X-User-Email": "@request.auth.email",
    "X-User-Name": "@request.auth.name"
  }
}
```

#### Mixed Usage

```json
{
  "headers": {
    "Authorization": "Bearer {env.API_KEY}",
    "X-Request-User": "@request.auth.id",
    "X-Custom-Header": "static-value"
  }
}
```

### Integration with Secrets

It's recommended to store sensitive API Keys in `_secrets` table and reference via template:

```json
{
  "headers": {
    "Authorization": "Bearer {secret.OPENAI_API_KEY}"
  }
}
```

::: tip Tip
Use `{secret.KEY_NAME}` syntax to retrieve encrypted key values from Secrets storage.
:::

::: warning Prerequisites
Using Secrets integration requires:
1. Setting `PB_MASTER_KEY` environment variable (64 hex characters)
2. Registering secrets plugin: `secrets.MustRegister(app, secrets.DefaultConfig())`

See [Secrets Management](./secrets.md) for details.
:::

### Auto-added Request Headers

The gateway automatically adds the following standard proxy headers:

| Header | Value |
|--------|-------|
| `X-Forwarded-For` | Client IP |
| `X-Forwarded-Host` | Original Host |
| `X-Forwarded-Proto` | Original protocol (http/https) |

## Common Use Cases

### 1. OpenAI API Proxy

Protect API Key and restrict user access:

```json
{
  "path": "/-/openai",
  "upstream": "https://api.openai.com",
  "stripPath": true,
  "accessRule": "@request.auth.id != ''",
  "headers": {
    "Authorization": "Bearer {env.OPENAI_API_KEY}"
  },
  "timeout": 120,
  "active": true
}
```

Frontend call:

```javascript
const response = await pb.send('/-/openai/v1/chat/completions', {
  method: 'POST',
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});
```

### 2. Stripe Webhook Receiver

Receive Stripe callbacks and forward to internal service:

```json
{
  "path": "/webhooks/stripe",
  "upstream": "http://payment-service:3000/stripe",
  "stripPath": true,
  "accessRule": "true",
  "headers": {
    "X-Internal-Secret": "{env.INTERNAL_SECRET}"
  },
  "timeout": 30,
  "active": true
}
```

### 3. Microservice Aggregation

Expose multiple internal services as unified API:

```json
// User service
{
  "path": "/-/users",
  "upstream": "http://user-service:3001",
  "accessRule": "@request.auth.id != ''"
}

// Order service
{
  "path": "/-/orders",
  "upstream": "http://order-service:3002",
  "accessRule": "@request.auth.id != ''"
}

// Payment service
{
  "path": "/-/payments",
  "upstream": "http://payment-service:3003",
  "accessRule": "@request.auth.role = 'admin'"
}
```

## Go SDK

```go
package main

import (
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // Create proxy configuration
        proxy := core.NewProxy(app)
        proxy.SetPath("/-/api")
        proxy.SetUpstream("https://api.example.com")
        proxy.SetStripPath(true)
        proxy.SetAccessRule("@request.auth.id != ''")
        proxy.SetHeaders(map[string]string{
            "Authorization": "Bearer {env.API_KEY}",
        })
        proxy.SetTimeout(30)
        proxy.SetActive(true)

        if err := app.Save(proxy); err != nil {
            return err
        }

        return se.Next()
    })

    app.Start()
}
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `404 Not Found` | Path not matched or proxy not enabled | Check `path` and `active` fields |
| `401 Unauthorized` | Auth Token not provided | Add `Authorization` header to request |
| `403 Forbidden` | User doesn't meet `accessRule` | Check user permissions and rule config |
| `502 Bad Gateway` | Upstream service unreachable | Check `upstream` URL and network |
| `504 Gateway Timeout` | Upstream response timeout | Increase `timeout` value |

### Debug Logging

Enable Debug logging to see proxy request details:

```bash
./pocketbase serve --debug
```

Log output example:

```
DEBUG proxy request method=POST path=/-/openai/v1/chat proxy_path=/-/openai upstream=https://api.openai.com status=200 duration_ms=1234
```

### Verify Configuration

Test proxy with curl:

```bash
# Test public proxy
curl -v http://localhost:8090/-/public/test

# Test authenticated proxy
curl -v http://localhost:8090/-/openai/v1/models \
  -H "Authorization: Bearer <pb_auth_token>"
```

## Best Practices

### Security Recommendations

1. **Principle of Least Privilege**: Use the strictest `accessRule`
2. **Use Secrets for Sensitive Keys**: Store in `_secrets` table, don't hardcode
3. **Set Reasonable Timeout**: Avoid long connection holds
4. **Disable Unused Proxies**: Set `active=false`

### Performance Optimization

1. **Use `stripPath=true`**: Reduce upstream URL length
2. **Set Appropriate `timeout`**: Adjust based on upstream response time
3. **Avoid Too Many Proxy Rules**: Each request iterates through rules table

### Naming Convention

```
/-/openai      ✅ Recommended: Use /-/ prefix
/-/stripe      ✅ Recommended: Clear service name
/api/proxy     ❌ Forbidden: Conflicts with PocketBase API
/_/custom      ❌ Forbidden: Conflicts with Admin UI
```

## Response Handling

### Request Header Pass-through

The following headers are passed to upstream:

- `Content-Type`
- `Accept`
- `User-Agent`
- All custom headers

### Response Pass-through

Upstream service responses are returned as-is to client, including:

- Status code
- Response headers
- Response body (supports Streaming)
