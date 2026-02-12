/**
 * Import Settings 页面
 * 导入 Collections 配置 - 与UI版本保持一致
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { getApiClient } from '@/lib/ApiClient'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Collection {
  id: string
  name: string
  type: string
  fields?: any[]
  indexes?: string[]
  oauth2?: { providers?: any }
  created?: string
  updated?: string
  [key: string]: any
}

interface CollectionPair {
  old: Collection | null
  new: Collection | null
}

// Helper functions
function findByKey<T>(arr: T[], key: keyof T, value: any): T | null {
  if (!Array.isArray(arr)) return null
  for (const item of arr) {
    if (item[key] == value) return item
  }
  return null
}

function filterDuplicatesByKey<T>(arr: T[], key: keyof T = 'id' as keyof T): T[] {
  if (!Array.isArray(arr)) return []
  const uniqueMap: Record<string, T> = {}
  for (const item of arr) {
    uniqueMap[String(item[key])] = item
  }
  return Object.values(uniqueMap)
}

function hasCollectionChanges(
  oldCollection: Collection | null,
  newCollection: Collection | null,
  withDeleteMissing = false
): boolean {
  if (!oldCollection || !newCollection) return true
  if (oldCollection.id !== newCollection.id) return true

  for (const prop in oldCollection) {
    if (prop !== 'fields' && JSON.stringify(oldCollection[prop]) !== JSON.stringify(newCollection[prop])) {
      return true
    }
  }

  const oldFields = Array.isArray(oldCollection.fields) ? oldCollection.fields : []
  const newFields = Array.isArray(newCollection.fields) ? newCollection.fields : []
  
  const removedFields = oldFields.filter(
    (oldField) => oldField?.id && !findByKey(newFields, 'id', oldField.id)
  )
  const addedFields = newFields.filter(
    (newField) => newField?.id && !findByKey(oldFields, 'id', newField.id)
  )
  const changedFields = newFields.filter((newField) => {
    const oldField = newField && findByKey(oldFields, 'id', newField.id)
    if (!oldField) return false
    for (const prop in oldField) {
      if (JSON.stringify(newField[prop]) !== JSON.stringify(oldField[prop])) {
        return true
      }
    }
    return false
  })

  return !!(addedFields.length || changedFields.length || (withDeleteMissing && removedFields.length))
}

function mergeUnique<T>(...arrays: T[][]): T[] {
  const result: T[] = []
  for (const arr of arrays) {
    for (const item of arr) {
      if (!result.includes(item)) {
        result.push(item)
      }
    }
  }
  return result
}

function displayValue(value: any): string {
  if (typeof value === 'undefined') return ''
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function hasValueChanges(valA: any, valB: any): boolean {
  if (valA === valB) return false
  return JSON.stringify(valA) !== JSON.stringify(valB)
}

// CollectionsDiffTable Component - Displays diff between two collections
interface CollectionsDiffTableProps {
  collectionA: Collection | null
  collectionB: Collection | null
  deleteMissing: boolean
}

function CollectionsDiffTable({ collectionA, collectionB, deleteMissing }: CollectionsDiffTableProps) {
  const isDeleteDiff = !collectionB?.id && !collectionB?.name
  const isCreateDiff = !isDeleteDiff && !collectionA?.id

  const fieldsListA = Array.isArray(collectionA?.fields) ? [...collectionA.fields] : []
  
  let fieldsListB = Array.isArray(collectionB?.fields) ? [...collectionB.fields] : []
  if (!deleteMissing) {
    fieldsListB = fieldsListB.concat(
      fieldsListA.filter((fieldA) => !fieldsListB.find((fieldB) => fieldA.id === fieldB.id))
    )
  }

  const removedFields = fieldsListA.filter(
    (fieldA) => !fieldsListB.find((fieldB) => fieldA.id === fieldB.id)
  )
  const sharedFields = fieldsListB.filter(
    (fieldB) => fieldsListA.find((fieldA) => fieldA.id === fieldB.id)
  )
  const addedFields = fieldsListB.filter(
    (fieldB) => !fieldsListA.find((fieldA) => fieldA.id === fieldB.id)
  )

  const hasAnyChange = hasCollectionChanges(collectionA, collectionB, deleteMissing)

  const mainModelProps = mergeUnique(
    Object.keys(collectionA || {}),
    Object.keys(collectionB || {})
  ).filter((key) => !['fields', 'created', 'updated'].includes(key))

  const getFieldById = (fields: any[], id: string) => {
    return fields?.find((f) => f.id === id) || null
  }

  return (
    <div className="mb-6">
      {/* Section Title */}
      <div className="flex items-center gap-2 mb-2">
        {!collectionA?.id ? (
          <>
            <span className="px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded">Added</span>
            <strong>{collectionB?.name}</strong>
          </>
        ) : !collectionB?.id ? (
          <>
            <span className="px-2 py-0.5 text-xs font-medium bg-destructive text-destructive-foreground rounded">Deleted</span>
            <strong>{collectionA?.name}</strong>
          </>
        ) : (
          <>
            {hasAnyChange && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded">Changed</span>
            )}
            {collectionA.name !== collectionB.name && (
              <>
                <strong className="line-through text-muted-foreground">{collectionA.name}</strong>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </>
            )}
            <strong>{collectionB.name}</strong>
          </>
        )}
      </div>

      {/* Diff Table */}
      <table className="w-full border-2 border-primary text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-4 py-2 text-left font-medium">Props</th>
            <th className="px-4 py-2 text-left font-medium w-[40%]">Old</th>
            <th className="px-4 py-2 text-left font-medium w-[40%]">New</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {/* Main Model Props */}
          {mainModelProps.map((prop) => {
            const oldVal = collectionA?.[prop]
            const newVal = collectionB?.[prop]
            const changed = hasValueChanges(oldVal, newVal)
            return (
              <tr key={prop} className={changed ? 'text-foreground' : ''}>
                <td className="px-4 py-1 border-b min-w-[120px]">{prop}</td>
                <td
                  className={`px-4 py-1 border-b ${
                    !isCreateDiff && changed ? 'bg-red-100' : isCreateDiff ? 'bg-muted' : ''
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(oldVal)}</pre>
                </td>
                <td
                  className={`px-4 py-1 border-b ${
                    !isDeleteDiff && changed ? 'bg-green-100' : isDeleteDiff ? 'bg-muted' : ''
                  }`}
                >
                  <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(newVal)}</pre>
                </td>
              </tr>
            )
          })}

          {/* Removed Fields */}
          {(deleteMissing || isDeleteDiff) &&
            removedFields.map((field) => (
              <React.Fragment key={`removed-${field.id}`}>
                <tr>
                  <th colSpan={3} className="px-4 py-2 text-left bg-muted/50 border-b">
                    <span>field: {field.name}</span>
                    <span className="ml-2 px-2 py-0.5 text-xs font-normal bg-destructive text-destructive-foreground rounded">
                      Deleted - <small>All stored data related to <strong>{field.name}</strong> will be deleted!</small>
                    </span>
                  </th>
                </tr>
                {Object.entries(field).map(([key, value]) => (
                  <tr key={`${field.id}-${key}`} className="text-foreground">
                    <td className="px-4 py-1 border-b pl-8">{key}</td>
                    <td className="px-4 py-1 border-b bg-red-100">
                      <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(value)}</pre>
                    </td>
                    <td className="px-4 py-1 border-b bg-muted" />
                  </tr>
                ))}
              </React.Fragment>
            ))}

          {/* Shared Fields */}
          {sharedFields.map((field) => {
            const oldField = getFieldById(fieldsListA, field.id)
            const fieldChanged = hasValueChanges(oldField, field)
            return (
              <React.Fragment key={`shared-${field.id}`}>
                <tr>
                  <th colSpan={3} className="px-4 py-2 text-left bg-muted/50 border-b">
                    <span>field: {field.name}</span>
                    {fieldChanged && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-normal bg-yellow-500 text-white rounded">
                        Changed
                      </span>
                    )}
                  </th>
                </tr>
                {Object.entries(field).map(([key, newValue]) => {
                  const oldValue = oldField?.[key]
                  const propChanged = hasValueChanges(oldValue, newValue)
                  return (
                    <tr key={`${field.id}-${key}`} className={propChanged ? 'text-foreground' : ''}>
                      <td className="px-4 py-1 border-b pl-8">{key}</td>
                      <td className={`px-4 py-1 border-b ${propChanged ? 'bg-red-100' : ''}`}>
                        <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(oldValue)}</pre>
                      </td>
                      <td className={`px-4 py-1 border-b ${propChanged ? 'bg-green-100' : ''}`}>
                        <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(newValue)}</pre>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* Added Fields */}
          {addedFields.map((field) => (
            <React.Fragment key={`added-${field.id}`}>
              <tr>
                <th colSpan={3} className="px-4 py-2 text-left bg-muted/50 border-b">
                  <span>field: {field.name}</span>
                  <span className="ml-2 px-2 py-0.5 text-xs font-normal bg-green-600 text-white rounded">
                    Added
                  </span>
                </th>
              </tr>
              {Object.entries(field).map(([key, value]) => (
                <tr key={`${field.id}-${key}`} className="text-foreground">
                  <td className="px-4 py-1 border-b pl-8">{key}</td>
                  <td className="px-4 py-1 border-b bg-muted" />
                  <td className="px-4 py-1 border-b bg-green-100">
                    <pre className="whitespace-pre-wrap break-all text-xs">{displayValue(value)}</pre>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Import() {
  const [schemas, setSchemas] = useState('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isLoadingOldCollections, setIsLoadingOldCollections] = useState(true)
  const [oldCollections, setOldCollections] = useState<Collection[]>([])
  const [newCollections, setNewCollections] = useState<Collection[]>([])
  const [mergeWithOldCollections, setMergeWithOldCollections] = useState(false)
  const [deleteMissing] = useState(true)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pb = getApiClient()

  // Load old collections on mount
  useEffect(() => {
    loadOldCollections()
  }, [])

  // Parse schemas when changed
  useEffect(() => {
    loadNewCollections()
  }, [schemas])

  const loadOldCollections = async () => {
    setIsLoadingOldCollections(true)
    try {
      const collections = await pb.collections.getFullList({ batch: 200 })
      // Clean up collections
      for (const collection of collections) {
        delete collection.created
        delete collection.updated
        if (collection.oauth2) {
          delete collection.oauth2.providers
        }
      }
      setOldCollections(collections as Collection[])
    } catch (err) {
      console.error(err)
    }
    setIsLoadingOldCollections(false)
  }

  const loadNewCollections = () => {
    let parsed: Collection[] = []
    try {
      parsed = JSON.parse(schemas)
    } catch (_) {}

    if (!Array.isArray(parsed)) {
      parsed = []
    } else {
      parsed = filterDuplicatesByKey(parsed, 'id')
    }

    // Normalizations
    for (const collection of parsed) {
      delete collection.created
      delete collection.updated
      if (collection.fields) {
        collection.fields = filterDuplicatesByKey(collection.fields, 'id')
      }
    }

    setNewCollections(parsed)
  }

  const isValid = useMemo(() => {
    return (
      !!schemas &&
      newCollections.length > 0 &&
      newCollections.every((item) => !!item.id && !!item.name)
    )
  }, [schemas, newCollections])

  const collectionsToDelete = useMemo(() => {
    return oldCollections.filter((collection) => {
      return (
        isValid &&
        !mergeWithOldCollections &&
        deleteMissing &&
        !findByKey(newCollections, 'id', collection.id)
      )
    })
  }, [oldCollections, newCollections, isValid, mergeWithOldCollections, deleteMissing])

  const collectionsToAdd = useMemo(() => {
    return newCollections.filter((collection) => {
      return isValid && !findByKey(oldCollections, 'id', collection.id)
    })
  }, [newCollections, oldCollections, isValid])

  const collectionsToUpdate = useMemo(() => {
    if (!isValid) return []
    const result: CollectionPair[] = []
    for (const newCollection of newCollections) {
      const oldCollection = findByKey(oldCollections, 'id', newCollection.id)
      if (
        !oldCollection?.id ||
        !hasCollectionChanges(oldCollection, newCollection, deleteMissing)
      ) {
        continue
      }
      result.push({ new: newCollection, old: oldCollection })
    }
    return result
  }, [newCollections, oldCollections, isValid, deleteMissing])

  const hasChanges = useMemo(() => {
    return !!schemas && (collectionsToDelete.length > 0 || collectionsToAdd.length > 0 || collectionsToUpdate.length > 0)
  }, [schemas, collectionsToDelete, collectionsToAdd, collectionsToUpdate])

  const canImport = !isLoadingOldCollections && isValid && hasChanges

  // Collections that can have IDs replaced
  const idReplacableCollections = useMemo(() => {
    return newCollections.filter((collection) => {
      const old =
        findByKey(oldCollections, 'name', collection.name) ||
        findByKey(oldCollections, 'id', collection.id)

      if (!old) return false
      if (old.id !== collection.id) return true

      const oldFields = Array.isArray(old.fields) ? old.fields : []
      const newFields = Array.isArray(collection.fields) ? collection.fields : []
      for (const field of newFields) {
        const oldFieldById = findByKey(oldFields, 'id', field.id)
        if (oldFieldById) continue
        const oldFieldByName = findByKey(oldFields, 'name', field.name)
        if (oldFieldByName && field.id !== oldFieldByName.id) return true
      }
      return false
    })
  }, [newCollections, oldCollections])

  const replaceIds = useCallback(() => {
    const updated = [...newCollections]
    for (const collection of updated) {
      const old =
        findByKey(oldCollections, 'name', collection.name) ||
        findByKey(oldCollections, 'id', collection.id)

      if (!old) continue

      const originalId = collection.id
      const replacedId = old.id
      collection.id = replacedId

      // Replace field IDs
      const oldFields = Array.isArray(old.fields) ? old.fields : []
      const newFields = Array.isArray(collection.fields) ? collection.fields : []
      for (const field of newFields) {
        const oldField = findByKey(oldFields, 'name', field.name)
        if (oldField?.id) {
          field.id = oldField.id
        }
      }

      // Update references
      for (const ref of updated) {
        if (!Array.isArray(ref.fields)) continue
        for (const field of ref.fields) {
          if (field.collectionId && field.collectionId === originalId) {
            field.collectionId = replacedId
          }
        }
      }

      // Update index names
      if (collection.indexes) {
        for (let i = 0; i < collection.indexes.length; i++) {
          collection.indexes[i] = collection.indexes[i].replace(
            /create\s+(?:unique\s+)?\s*index\s*(?:if\s+not\s+exists\s+)?(\S*)\s+on/gim,
            (v) => v.replace(originalId, replacedId)
          )
        }
      }
    }
    setSchemas(JSON.stringify(updated, null, 4))
  }, [newCollections, oldCollections])

  const loadFile = (file: File) => {
    setIsLoadingFile(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      setIsLoadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      const content = event.target?.result as string
      setSchemas(content)
    }
    reader.onerror = () => {
      toast.error('Failed to load the imported JSON.')
      setIsLoadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const clear = () => {
    setSchemas('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleReview = () => {
    setShowReviewDialog(true)
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const collectionsToImport = !mergeWithOldCollections
        ? newCollections
        : filterDuplicatesByKey([...oldCollections, ...newCollections], 'id')
      
      await pb.collections.import(collectionsToImport, deleteMissing)
      toast.success('Successfully imported collections configuration.')
      setShowReviewDialog(false)
      clear()
      loadOldCollections()
    } catch (err: any) {
      toast.error(err.message || 'Failed to import collections')
    } finally {
      setIsImporting(false)
    }
  }

  // Build pairs for review dialog
  const reviewPairs = useMemo(() => {
    const pairs: CollectionPair[] = []
    const collectionsToImport = !mergeWithOldCollections
      ? newCollections
      : filterDuplicatesByKey([...oldCollections, ...newCollections], 'id')

    // Modified and deleted
    for (const oldCollection of oldCollections) {
      const newCollection = findByKey(collectionsToImport, 'id', oldCollection.id)
      if (
        (deleteMissing && !newCollection?.id) ||
        (newCollection?.id && hasCollectionChanges(oldCollection, newCollection, deleteMissing))
      ) {
        pairs.push({ old: oldCollection, new: newCollection })
      }
    }

    // Only new collections
    for (const newCollection of collectionsToImport) {
      const oldCollection = findByKey(oldCollections, 'id', newCollection.id)
      if (!oldCollection?.id) {
        pairs.push({ old: null, new: newCollection })
      }
    }

    return pairs
  }, [oldCollections, newCollections, mergeWithOldCollections, deleteMissing])

  return (
    <div className="p-6 max-w-4xl">
      {/* Page header */}
      <header className="mb-6">
        <nav className="text-sm text-muted-foreground mb-2">
          <span>Settings</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Import collections</span>
        </nav>
      </header>

      {isLoadingOldCollections ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                loadFile(e.target.files[0])
              }
            }}
          />

          {/* Description with load button */}
          <div className="text-base">
            Paste below the collections configuration you want to import or{' '}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingFile}
            >
              {isLoadingFile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Load from JSON file
            </Button>
          </div>

          {/* Collections textarea */}
          <div className="space-y-2">
            <Label htmlFor="collections">Collections</Label>
            <textarea
              id="collections"
              className={`w-full min-h-[320px] px-3 py-2 border rounded-md bg-background font-mono text-sm ${
                schemas && !isValid ? 'border-destructive' : ''
              }`}
              spellCheck={false}
              value={schemas}
              onChange={(e) => setSchemas(e.target.value)}
            />
            {schemas && !isValid && (
              <p className="text-sm text-destructive">Invalid collections configuration.</p>
            )}
          </div>

          {/* Merge option */}
          {newCollections.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="merge"
                checked={mergeWithOldCollections}
                onCheckedChange={(checked) => setMergeWithOldCollections(checked as boolean)}
                disabled={!isValid}
              />
              <Label htmlFor="merge" className="cursor-pointer">
                Merge with the existing collections
              </Label>
            </div>
          )}

          {/* Up-to-date message */}
          {isValid && newCollections.length > 0 && !hasChanges && (
            <Alert>
              <AlertDescription>
                <strong>Your collections configuration is already up-to-date!</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Detected changes */}
          {isValid && newCollections.length > 0 && hasChanges && (
            <div>
              <h5 className="text-sm font-medium mb-3">Detected changes</h5>
              <div className="border rounded-md divide-y">
                {/* Deleted */}
                {collectionsToDelete.map((collection) => (
                  <div key={collection.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-destructive text-destructive-foreground rounded min-w-[65px] text-center">
                      Deleted
                    </span>
                    <div className="flex items-center gap-2">
                      <strong>{collection.name}</strong>
                      {collection.id && (
                        <small className="text-muted-foreground">{collection.id}</small>
                      )}
                    </div>
                  </div>
                ))}

                {/* Changed */}
                {collectionsToUpdate.map((pair) => (
                  <div key={`${pair.old?.id}-${pair.new?.id}`} className="flex items-center gap-3 px-4 py-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500 text-white rounded min-w-[65px] text-center">
                      Changed
                    </span>
                    <div className="flex items-center gap-2">
                      {pair.old?.name !== pair.new?.name && (
                        <>
                          <strong className="line-through text-muted-foreground">
                            {pair.old?.name}
                          </strong>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </>
                      )}
                      <strong>{pair.new?.name}</strong>
                      {pair.new?.id && (
                        <small className="text-muted-foreground">{pair.new.id}</small>
                      )}
                    </div>
                  </div>
                ))}

                {/* Added */}
                {collectionsToAdd.map((collection) => (
                  <div key={collection.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded min-w-[65px] text-center">
                      Added
                    </span>
                    <div className="flex items-center gap-2">
                      <strong>{collection.name}</strong>
                      {collection.id && (
                        <small className="text-muted-foreground">{collection.id}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID replacement warning */}
          {idReplacableCollections.length > 0 && (
            <Alert variant="destructive" className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-yellow-800">
                  Some of the imported collections share the same name and/or fields but are
                  imported with different IDs. You can replace them in the import if you want to.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                  onClick={replaceIds}
                >
                  Replace with original ids
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Bottom buttons */}
          <div className="flex items-center">
            {schemas && (
              <Button variant="ghost" className="text-muted-foreground" onClick={clear}>
                Clear
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="default"
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              disabled={!canImport}
              onClick={handleReview}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <DialogTitle className="text-center text-lg">Side-by-side diff</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-6 overflow-y-auto flex-grow min-h-0">
            {reviewPairs.map((pair, index) => (
              <CollectionsDiffTable
                key={index}
                collectionA={pair.old}
                collectionB={pair.new}
                deleteMissing={deleteMissing}
              />
            ))}
          </div>

          <DialogFooter className="p-6 pt-4 border-t flex-shrink-0 bg-background">
            <Button variant="ghost" onClick={() => setShowReviewDialog(false)} disabled={isImporting}>
              Close
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm and import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Import
