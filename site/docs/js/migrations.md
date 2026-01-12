# Migrations (JavaScript)

PocketBase supports JavaScript migrations for version controlling your database schema.

## Creating migrations

Migrations are JavaScript files placed in the `pb_migrations` directory.

```javascript
// pb_migrations/1234567890_create_posts.js

migrate((app) => {
    // up migration
    const collection = new Collection()
    collection.name = "posts"
    collection.type = "base"
    
    collection.fields.add(new TextField({
        name: "title",
        required: true
    }))
    
    app.save(collection)
}, (app) => {
    // down migration (optional)
    const collection = app.findCollectionByNameOrId("posts")
    app.delete(collection)
})
```

## Running migrations

Migrations are automatically executed when starting PocketBase. You can also run them manually:

```bash
./pocketbase migrate up    # run all pending migrations
./pocketbase migrate down  # revert the last migration
```

## Auto-generating migrations

PocketBase can auto-generate migration files from Dashboard changes:

```bash
./pocketbase migrate collections
```

## Migration file naming

Files should be named with a timestamp prefix for proper ordering:

```
pb_migrations/
    1704067200_create_users.js
    1704067300_create_posts.js
    1704067400_add_categories.js
```

## Best practices

1. **Test migrations** - Test both up and down migrations
2. **Keep migrations small** - One change per migration
3. **Version control** - Commit migration files to git
4. **Don't modify old migrations** - Create new ones instead
