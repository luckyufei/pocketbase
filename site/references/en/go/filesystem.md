# Filesystem

PocketBase provides filesystem helpers for working with files and the configured storage (local or S3).

## Accessing the filesystem

```go
// Get the main files storage
fs, err := app.NewFilesystem()
if err != nil {
    return err
}
defer fs.Close()

// Get the backups storage
backupsFs, err := app.NewBackupsFilesystem()
if err != nil {
    return err
}
defer backupsFs.Close()
```

## Reading files

```go
// Check if a file exists
exists, err := fs.Exists("path/to/file.txt")

// Get file attributes
attrs, err := fs.Attributes("path/to/file.txt")

// Read file content
reader, err := fs.GetFile("path/to/file.txt")
if err != nil {
    return err
}
defer reader.Close()

content, err := io.ReadAll(reader)
```

## Writing files

```go
// Upload from reader
err := fs.Upload(strings.NewReader("Hello World"), "path/to/file.txt")

// Upload from bytes
err := fs.UploadBytes([]byte("Hello World"), "path/to/file.txt")

// Upload from file
file, _ := os.Open("/local/path/to/file.txt")
defer file.Close()
err := fs.Upload(file, "path/to/file.txt")
```

## Deleting files

```go
// Delete a single file
err := fs.Delete("path/to/file.txt")

// Delete with prefix (all files starting with the prefix)
err := fs.DeletePrefix("path/to/")
```

## Serving files

```go
// Serve a file with optional thumb generation
err := fs.Serve(
    response,           // http.ResponseWriter
    request,            // *http.Request
    "path/to/file.jpg",
    "filename.jpg",     // download filename
)
```

## S3 configuration

S3 storage can be configured from the Dashboard under Settings > Files storage, or programmatically:

```go
settings := app.Settings()
settings.S3.Enabled = true
settings.S3.Bucket = "my-bucket"
settings.S3.Region = "us-east-1"
settings.S3.Endpoint = "s3.amazonaws.com"
settings.S3.AccessKey = "..."
settings.S3.Secret = "..."

if err := app.Save(settings); err != nil {
    return err
}
```
