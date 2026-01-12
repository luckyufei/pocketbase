# Filesystem (JavaScript)

PocketBase provides filesystem helpers for working with files and storage.

## Accessing the filesystem

```javascript
// Get the main files storage
const fs = $app.newFilesystem()

// Get the backups storage
const backupsFs = $app.newBackupsFilesystem()
```

## Reading files

```javascript
const fs = $app.newFilesystem()

try {
    // Check if file exists
    const exists = fs.exists("path/to/file.txt")
    
    // Get file attributes
    const attrs = fs.attributes("path/to/file.txt")
    console.log(attrs.size, attrs.modTime)
    
    // Read file content
    const reader = fs.getFile("path/to/file.txt")
    // Process reader...
} finally {
    fs.close()
}
```

## Writing files

```javascript
const fs = $app.newFilesystem()

try {
    // Upload content
    fs.upload(content, "path/to/file.txt")
} finally {
    fs.close()
}
```

## Deleting files

```javascript
const fs = $app.newFilesystem()

try {
    // Delete a single file
    fs.delete("path/to/file.txt")
    
    // Delete with prefix
    fs.deletePrefix("path/to/")
} finally {
    fs.close()
}
```

## Working with record files

```javascript
onRecordCreate((e) => {
    // Get uploaded files
    const files = e.record.getUnsavedFiles("attachment")
    
    for (const file of files) {
        console.log("Uploaded:", file.name, file.size)
    }
    
    e.next()
}, "documents")
```

## Example: File processing

```javascript
onRecordCreate((e) => {
    const files = e.record.getUnsavedFiles("image")
    
    for (const file of files) {
        // Validate file size
        if (file.size > 10 * 1024 * 1024) { // 10MB
            throw new BadRequestError("File too large")
        }
        
        // Validate mime type
        if (!file.type.startsWith("image/")) {
            throw new BadRequestError("Only images allowed")
        }
    }
    
    e.next()
}, "photos")
```
