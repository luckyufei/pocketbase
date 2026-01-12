# Record Proxy

PocketBase allows you to create custom record types that wrap the base `core.Record` type, providing type-safe accessors for your collection fields.

## Creating a record proxy

```go
type Post struct {
    core.Record
}

// Type-safe getter for the title field
func (p *Post) Title() string {
    return p.GetString("title")
}

// Type-safe setter for the title field
func (p *Post) SetTitle(title string) {
    p.Set("title", title)
}

// Type-safe getter for the author relation
func (p *Post) Author() *core.Record {
    return p.ExpandedOne("author")
}

// Type-safe getter for published status
func (p *Post) IsPublished() bool {
    return p.GetBool("published")
}

// Custom method
func (p *Post) Summary() string {
    content := p.GetString("content")
    if len(content) > 100 {
        return content[:100] + "..."
    }
    return content
}
```

## Using record proxies

```go
// Fetch a record and convert to proxy
record, err := app.FindRecordById("posts", "RECORD_ID")
if err != nil {
    return err
}

post := &Post{Record: *record}

// Now you can use type-safe methods
title := post.Title()
author := post.Author()

// Set values
post.SetTitle("New Title")
app.Save(&post.Record)
```

## Creating new records with proxies

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

post := &Post{Record: *core.NewRecord(collection)}
post.SetTitle("My First Post")
post.Set("content", "Hello World!")
post.Set("published", true)

if err := app.Save(&post.Record); err != nil {
    return err
}
```

## Registering record factories

For automatic conversion when fetching records:

```go
app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
    // Register a factory for the "posts" collection
    e.App.RegisterRecordFactory("posts", func(record *core.Record) core.RecordProxy {
        return &Post{Record: *record}
    })
    
    return e.Next()
})
```

## Benefits

1. **Type safety** - Catch field name typos at compile time.

2. **IDE support** - Get autocomplete and documentation for your fields.

3. **Encapsulation** - Add custom methods and business logic to your records.

4. **Validation** - Add field-level validation in setters.

5. **Computed fields** - Create computed properties based on record data.
