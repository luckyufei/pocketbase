# Concurrent Edit Strategy

This document describes the concurrent editing strategy implemented in the PocketBase Admin UI record management system.

## Overview

When multiple users edit the same record simultaneously, there's a risk of data conflicts. This document outlines our approach to handling such scenarios.

## Current Implementation

### Optimistic Concurrency

The system uses **optimistic concurrency control** with the following characteristics:

1. **Last Write Wins**: In the current implementation, the last save operation will overwrite previous changes.
2. **Change Detection**: The UI tracks changes from the initial record state to determine if saving is allowed.
3. **Draft Persistence**: Unsaved changes are stored locally using the draft system.

### Change Detection Hook

```typescript
const { hasChanges, setInitialData, isFieldChanged } = useChangeDetection()
```

The `useChangeDetection` hook provides:
- `hasChanges`: Boolean indicating if form has unsaved changes
- `setInitialData`: Function to set baseline for change detection
- `isFieldChanged`: Function to check if specific field has changed

### canSave Logic

```typescript
function canSave({ saving, isNew, hasChanges }): boolean {
  if (saving) return false      // Block during save operation
  if (isNew) return true        // New records can always be saved
  return hasChanges             // Existing records need changes
}
```

Rules:
- Cannot save while a save operation is in progress
- New records can always be saved (even without explicit changes)
- Existing records require at least one field change to enable save

## Draft System

The draft system provides local persistence for unsaved changes:

```typescript
const { draft, saveDraft, clearDraft, hasDraft } = useDraft(draftKey)
```

Features:
- Drafts are stored in localStorage
- Each record has a unique draft key based on collection and record ID
- Drafts are automatically loaded when reopening a record
- User is prompted to restore draft on panel open

## Future Improvements

### Recommended Enhancements

1. **Version Conflict Detection**
   - Store record version/updated timestamp
   - Check version before save
   - Show conflict resolution UI when versions mismatch

2. **Real-time Collaboration**
   - WebSocket-based change notifications
   - Visual indicators showing other active editors
   - Automatic refresh of changed fields

3. **Field-level Merging**
   - Allow selective merge of conflicting fields
   - Show diff view for changed fields
   - Support three-way merge

4. **Locking Mechanism**
   - Soft locks to warn other users
   - Auto-release locks after timeout
   - Force unlock option for admins

## API Considerations

PocketBase API supports optimistic locking via the `@updated` field:

```javascript
// Check if record was modified since we loaded it
await pb.collection('posts').update(id, data, {
  expand: '@updated'
})
```

The UI can use this to detect and handle conflicts gracefully.

## Best Practices

1. **Save Often**: Encourage users to save changes frequently
2. **Small Edits**: Make focused changes rather than large batch updates  
3. **Communicate**: Use comments or external tools to coordinate edits
4. **Review Changes**: Use audit logs to track who made what changes
