# Miscellaneous

This page covers various utility functions and helpers available in PocketBase.

## Security helpers

```go
// Generate a random string
randomStr := security.RandomString(32)

// Generate a random string with custom alphabet
randomStr := security.RandomStringWithAlphabet(32, "abc123")

// Hash a password
hash := security.HashPassword("password123")

// Verify a password
valid := security.ValidatePassword("password123", hash)

// Generate a JWT token
token, err := security.NewJWT(claims, signingKey, duration)

// Parse a JWT token
claims, err := security.ParseJWT(token, signingKey)
```

## Type helpers

```go
// DateTime operations
now := types.NowDateTime()
parsed, err := types.ParseDateTime("2023-01-01 00:00:00.000Z")

// JSON types
jsonArr := types.JSONArray[string]{"a", "b", "c"}
jsonMap := types.JSONMap{"key": "value"}
jsonRaw := types.JSONRaw(`{"key": "value"}`)

// Pointer helper
strPtr := types.Pointer("hello")
```

## Validation

```go
import "github.com/pocketbase/pocketbase/tools/validation"

// Email validation
err := validation.Is(email, validation.Email)

// URL validation
err := validation.Is(url, validation.URL)

// Required validation
err := validation.Is(value, validation.Required)

// Length validation
err := validation.Is(str, validation.Length(5, 100))
```

## Inflector

```go
import "github.com/pocketbase/pocketbase/tools/inflector"

// Pluralize
plural := inflector.Pluralize("post") // "posts"

// Singularize
singular := inflector.Singularize("posts") // "post"

// Columnify (convert to snake_case)
column := inflector.Columnify("SomeField") // "some_field"

// UcFirst (uppercase first letter)
upper := inflector.UcFirst("hello") // "Hello"
```

## HTTP client

```go
import "github.com/pocketbase/pocketbase/tools/rest"

// Simple GET request
response, err := rest.Get("https://api.example.com/data")

// POST request with JSON body
response, err := rest.Post("https://api.example.com/data", map[string]any{
    "key": "value",
})

// Custom request
client := rest.NewClient()
response, err := client.Send(&rest.Request{
    Method:  "PUT",
    URL:     "https://api.example.com/data",
    Body:    body,
    Headers: map[string]string{"Authorization": "Bearer token"},
})
```
