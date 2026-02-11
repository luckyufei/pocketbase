/**
 * Field Skip Rules - Utility functions for determining which fields to skip
 * Used in record forms to filter out system fields and auto-generated fields
 */
import type { CollectionField, CollectionModel } from 'pocketbase'

// Base collection fields that should be skipped (system fields)
export const BASE_SKIP_FIELD_NAMES = ['id', 'created', 'updated']

// Auth collection fields that should be skipped (handled separately by AuthFields)
export const AUTH_SKIP_FIELD_NAMES = [
  ...BASE_SKIP_FIELD_NAMES,
  'email',
  'emailVisibility',
  'password',
  'passwordConfirm',
  'verified',
  'tokenKey',
]

/**
 * Determine if a field should be skipped based on collection type and field properties
 */
export function shouldSkipField(
  field: CollectionField,
  collectionType: CollectionModel['type'],
  options: {
    includeId?: boolean
    includeAutodate?: boolean
    includeHidden?: boolean
  } = {}
): boolean {
  const { includeId = false, includeAutodate = false, includeHidden = false } = options

  // Skip hidden fields unless explicitly included
  if (field.hidden && !includeHidden) {
    return true
  }

  // Skip autodate fields unless explicitly included
  if (field.type === 'autodate' && !includeAutodate) {
    return true
  }

  // Handle ID field
  if (field.name === 'id' && !includeId) {
    return true
  }

  // Skip created/updated system fields
  if (['created', 'updated'].includes(field.name)) {
    return true
  }

  // Auth collection specific fields
  if (collectionType === 'auth') {
    const authSpecificFields = [
      'email',
      'emailVisibility',
      'password',
      'passwordConfirm',
      'verified',
      'tokenKey',
    ]
    if (authSpecificFields.includes(field.name)) {
      return true
    }
  }

  return false
}

/**
 * Filter collection fields to only include editable fields
 */
export function getEditableFields(
  collection: CollectionModel | null,
  options: {
    includeId?: boolean
    includeAutodate?: boolean
    includeHidden?: boolean
  } = {}
): CollectionField[] {
  if (!collection?.fields) {
    return []
  }

  return collection.fields.filter(
    (field) => !shouldSkipField(field, collection.type, options)
  )
}

/**
 * Get skip field names for a given collection type
 */
export function getSkipFieldNames(collectionType: CollectionModel['type']): string[] {
  return collectionType === 'auth' ? AUTH_SKIP_FIELD_NAMES : BASE_SKIP_FIELD_NAMES
}
