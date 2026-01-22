# Testing

PocketBase provides testing utilities to help you write tests for your custom code.

## Setting up a test app

```go
package myapp_test

import (
    "testing"
    
    "github.com/pocketbase/pocketbase/tests"
)

func TestMyFeature(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // Your test code here
}
```

## Testing with existing data

```go
func TestWithData(t *testing.T) {
    app, err := tests.NewTestApp("./testdata")
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // The app is initialized with data from ./testdata
}
```

## Testing API endpoints

```go
func TestAPIEndpoint(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // Create a test request
    req := httptest.NewRequest("GET", "/api/collections", nil)
    rec := httptest.NewRecorder()
    
    // Execute the request
    app.ServeHTTP(rec, req)
    
    // Assert the response
    if rec.Code != 200 {
        t.Errorf("Expected status 200, got %d", rec.Code)
    }
}
```

## Testing with authentication

```go
func TestAuthenticatedRequest(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    // Create a test user
    collection, _ := app.FindCollectionByNameOrId("users")
    user := core.NewRecord(collection)
    user.Set("email", "test@example.com")
    user.SetPassword("password123")
    app.Save(user)
    
    // Generate auth token
    token, _ := user.NewAuthToken()
    
    // Create authenticated request
    req := httptest.NewRequest("GET", "/api/collections/posts/records", nil)
    req.Header.Set("Authorization", token)
    rec := httptest.NewRecorder()
    
    app.ServeHTTP(rec, req)
}
```

## Testing hooks

```go
func TestHook(t *testing.T) {
    app, err := tests.NewTestApp()
    if err != nil {
        t.Fatal(err)
    }
    defer app.Cleanup()
    
    hookCalled := false
    
    app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
        hookCalled = true
        return e.Next()
    })
    
    // Create a record to trigger the hook
    collection, _ := app.FindCollectionByNameOrId("posts")
    record := core.NewRecord(collection)
    record.Set("title", "Test")
    app.Save(record)
    
    if !hookCalled {
        t.Error("Expected hook to be called")
    }
}
```

## Best practices

1. **Use separate test data** - Keep test data separate from production data.

2. **Clean up after tests** - Always call `app.Cleanup()` to remove temporary files.

3. **Test edge cases** - Test error conditions and edge cases, not just happy paths.

4. **Use table-driven tests** - For testing multiple scenarios, use Go's table-driven test pattern.

5. **Mock external services** - Mock external APIs and services in tests.
