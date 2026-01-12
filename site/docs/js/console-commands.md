# Console Commands (JavaScript)

PocketBase allows you to register custom console commands in JavaScript.

## Registering commands

```javascript
$app.rootCmd.addCommand(new Command({
    use: "hello",
    short: "Prints hello world",
    run: (cmd, args) => {
        console.log("Hello World!")
    }
}))
```

## Commands with arguments

```javascript
$app.rootCmd.addCommand(new Command({
    use: "greet [name]",
    short: "Greet someone",
    run: (cmd, args) => {
        const name = args.length > 0 ? args[0] : "World"
        console.log(`Hello, ${name}!`)
    }
}))
```

## Running commands

```bash
./pocketbase hello
./pocketbase greet John
```

## Example: Data export command

```javascript
$app.rootCmd.addCommand(new Command({
    use: "export-posts",
    short: "Export all posts to JSON",
    run: (cmd, args) => {
        const records = $app.findAllRecords("posts")
        
        const data = records.map(r => ({
            id: r.id,
            title: r.getString("title"),
            created: r.getString("created")
        }))
        
        console.log(JSON.stringify(data, null, 2))
    }
}))
```

## Built-in commands

PocketBase includes several built-in commands:

- `serve` - Start the web server
- `migrate` - Run database migrations
- `superuser` - Manage superuser accounts
- `version` - Print version info
