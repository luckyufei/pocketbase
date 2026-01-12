# Migrations

PocketBase supports Go migrations for version controlling your database schema.

## Creating migrations

Migrations are Go files placed in the `pb_migrations` directory. Each migration file should have a unique name (usually with a timestamp prefix).

```go
// pb_migrations/1234567890_create_posts.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // up migration
        collection := core.NewBaseCollection("posts")
        
        collection.Fields.Add(&core.TextField{
            Name:     "title",
            Required: true,
        })
        
        return app.Save(collection)
    }, func(app core.App) error {
        // down migration (optional)
        collection, err := app.FindCollectionByNameOrId("posts")
        if err != nil {
            return err
        }
        return app.Delete(collection)
    })
}
```

## Running migrations

Migrations are automatically executed when starting PocketBase. You can also run them manually:

```bash
./pocketbase migrate up    # run all pending migrations
./pocketbase migrate down  # revert the last migration
```

## Auto-generating migrations

PocketBase can auto-generate migration files from the Dashboard changes:

```bash
./pocketbase migrate collections
```

This creates a snapshot migration of all current collections.

## Best practices

1. **Always test migrations** - Test both up and down migrations in a development environment.

2. **Keep migrations small** - Each migration should do one thing.

3. **Use transactions** - Wrap complex migrations in transactions.

4. **Version control** - Commit migration files to your version control system.

5. **Don't modify old migrations** - Create new migrations instead of modifying existing ones.
