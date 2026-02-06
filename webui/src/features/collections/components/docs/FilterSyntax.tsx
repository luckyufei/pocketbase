/**
 * FilterSyntax component
 * Filter syntax documentation
 */
import { useMemo } from 'react'
import { FILTER_OPERATORS, getAllCollectionIdentifiers } from '@/lib/apiDocsUtils'
import { CodeBlock } from './CodeBlock'

interface FilterSyntaxProps {
  className?: string
  collection?: {
    type: string
    fields?: Array<{ name: string }>
  }
}

export function FilterSyntax({ className, collection }: FilterSyntaxProps) {
  const fieldNames = useMemo(() => {
    if (!collection) return []
    return getAllCollectionIdentifiers(collection)
  }, [collection])

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-3">Supported filter operators and syntax:</p>

      <div className="space-y-4">
        {/* Operators table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-24">Operator</th>
                <th className="text-left p-2 font-medium">Description</th>
                <th className="text-left p-2 font-medium w-40">Example</th>
              </tr>
            </thead>
            <tbody>
              {FILTER_OPERATORS.map((op) => (
                <tr key={op.operator} className="border-t">
                  <td className="p-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{op.operator}</code>
                  </td>
                  <td className="p-2 text-muted-foreground">{op.description}</td>
                  <td className="p-2">
                    <code className="text-xs">{op.example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Supported filter fields */}
        {fieldNames.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Supported filter fields:</p>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs">
                {fieldNames.map((name, i) => (
                  <span key={name}>
                    <code>{name}</code>{i < fieldNames.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}

        {/* Examples */}
        <div>
          <p className="text-sm font-medium mb-2">Filter examples:</p>
          <CodeBlock
            content={`// Simple filter
?filter=(status='active')

// Multiple conditions
?filter=(status='active' && created>'2024-01-01')

// Using OR
?filter=(status='active' || status='pending')

// Nested conditions
?filter=((status='active' && priority>5) || featured=true)

// Relation field filter
?filter=(author.name~'John')

// Array contains
?filter=(tags?~'important')`}
            language="text"
            showCopy={false}
          />
        </div>

        {/* Special values */}
        <div>
          <p className="text-sm font-medium mb-2">Special values:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <code className="text-xs">@now</code> - Current datetime
            </li>
            <li>
              <code className="text-xs">@request.auth.id</code> - Current authenticated user ID
            </li>
            <li>
              <code className="text-xs">@request.auth.collectionId</code> - Current authenticated user collection ID
            </li>
            <li>
              <code className="text-xs">@collection.collectionName.fieldName</code> - Reference to another collection's field
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
