# Collection Operations

This page describes how to work with collections programmatically in Go.

## Fetching collections

```go
// find a collection by name or id
collection, err := app.FindCollectionByNameOrId("posts")

// find all collections
collections, err := app.FindAllCollections()

// find collections by type
authCollections, err := app.FindAllCollections("auth")
baseCollections, err := app.FindAllCollections("base")
viewCollections, err := app.FindAllCollections("view")
```

## Creating collections

```go
collection := core.NewBaseCollection("posts")

// add fields
collection.Fields.Add(&core.TextField{
    Name:     "title",
    Required: true,
    Max:      100,
})

collection.Fields.Add(&core.EditorField{
    Name: "content",
})

// set rules
collection.ListRule = types.Pointer("")  // everyone can list
collection.ViewRule = types.Pointer("")  // everyone can view
collection.CreateRule = types.Pointer("@request.auth.id != ''") // only authenticated
collection.UpdateRule = types.Pointer("@request.auth.id = author.id") // only author
collection.DeleteRule = nil // only superusers

if err := app.Save(collection); err != nil {
    return err
}
```

## Creating auth collections

```go
collection := core.NewAuthCollection("users")

// add custom fields
collection.Fields.Add(&core.TextField{
    Name: "name",
    Max:  100,
})

collection.Fields.Add(&core.FileField{
    Name:      "avatar",
    MaxSelect: 1,
    MaxSize:   5 * 1024 * 1024, // 5MB
    MimeTypes: []string{"image/jpeg", "image/png"},
})

if err := app.Save(collection); err != nil {
    return err
}
```

## Updating collections

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

// update rules
collection.ListRule = types.Pointer("status = 'published'")

// add a new field
collection.Fields.Add(&core.BoolField{
    Name: "featured",
})

if err := app.Save(collection); err != nil {
    return err
}
```

## Deleting collections

```go
collection, err := app.FindCollectionByNameOrId("posts")
if err != nil {
    return err
}

if err := app.Delete(collection); err != nil {
    return err
}
```

## Field types

PocketBase supports the following field types:

- `TextField` - Plain text
- `EditorField` - Rich text editor
- `NumberField` - Numeric values
- `BoolField` - Boolean (true/false)
- `EmailField` - Email addresses
- `URLField` - URLs
- `DateField` - Date and time
- `SelectField` - Single or multiple select
- `FileField` - File uploads
- `RelationField` - Relations to other collections
- `JSONField` - JSON data
- `AutodateField` - Auto-generated timestamps

Each field type has its own set of options. Refer to the [PocketBase Go documentation](https://pkg.go.dev/github.com/pocketbase/pocketbase/core) for details.
