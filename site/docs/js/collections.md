# Collection Operations (JavaScript)

## Fetching collections

```javascript
// Find by name or ID
const collection = $app.findCollectionByNameOrId("posts")

// Find all collections
const collections = $app.findAllCollections()

// Find by type
const authCollections = $app.findAllCollections("auth")
const baseCollections = $app.findAllCollections("base")
```

## Creating collections

```javascript
const collection = new Collection()
collection.name = "posts"
collection.type = "base"

// Add fields
collection.fields.add(new TextField({
    name: "title",
    required: true,
    max: 100
}))

collection.fields.add(new EditorField({
    name: "content"
}))

// Set rules
collection.listRule = ""  // everyone can list
collection.viewRule = ""  // everyone can view
collection.createRule = "@request.auth.id != ''" // only authenticated
collection.updateRule = "@request.auth.id = author.id" // only author
collection.deleteRule = null // only superusers

$app.save(collection)
```

## Creating auth collections

```javascript
const collection = new Collection()
collection.name = "users"
collection.type = "auth"

// Add custom fields
collection.fields.add(new TextField({
    name: "name",
    max: 100
}))

collection.fields.add(new FileField({
    name: "avatar",
    maxSelect: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    mimeTypes: ["image/jpeg", "image/png"]
}))

$app.save(collection)
```

## Updating collections

```javascript
const collection = $app.findCollectionByNameOrId("posts")

// Update rules
collection.listRule = "status = 'published'"

// Add a new field
collection.fields.add(new BoolField({
    name: "featured"
}))

$app.save(collection)
```

## Deleting collections

```javascript
const collection = $app.findCollectionByNameOrId("posts")

$app.delete(collection)
```

## Field types

Available field types:

- `TextField` - Plain text
- `EditorField` - Rich text
- `NumberField` - Numbers
- `BoolField` - Boolean
- `EmailField` - Email
- `URLField` - URLs
- `DateField` - Date/time
- `SelectField` - Select options
- `FileField` - File uploads
- `RelationField` - Relations
- `JSONField` - JSON data
- `AutodateField` - Auto timestamps
