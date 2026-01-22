# Console Commands

PocketBase allows you to register custom console commands using the Cobra command library.

## Registering commands

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use:   "hello",
    Short: "Prints hello world",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Println("Hello World!")
    },
})
```

## Commands with flags

```go
var name string

cmd := &cobra.Command{
    Use:   "greet",
    Short: "Greet someone",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Printf("Hello, %s!\n", name)
    },
}

cmd.Flags().StringVarP(&name, "name", "n", "World", "Name to greet")

app.RootCmd.AddCommand(cmd)
```

## Commands with arguments

```go
app.RootCmd.AddCommand(&cobra.Command{
    Use:   "process [file]",
    Short: "Process a file",
    Args:  cobra.ExactArgs(1),
    Run: func(cmd *cobra.Command, args []string) {
        filename := args[0]
        fmt.Printf("Processing %s...\n", filename)
    },
})
```

## Running commands

```bash
./pocketbase hello
./pocketbase greet --name John
./pocketbase process myfile.txt
```

## Built-in commands

PocketBase includes several built-in commands:

- `serve` - Start the web server
- `migrate` - Run database migrations
- `superuser` - Manage superuser accounts
- `version` - Print version info

For more information about Cobra commands, see the [Cobra documentation](https://github.com/spf13/cobra).
