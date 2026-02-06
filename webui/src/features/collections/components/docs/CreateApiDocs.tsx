/**
 * CreateApiDocs component
 * Create API documentation
 */
import { useMemo } from 'react'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { ResponseTabs } from './ResponseTabs'
import { getApiEndpoint, generateDummyRecord } from '@/lib/apiDocsUtils'

interface Field {
  name: string
  type: string
  required?: boolean
  hidden?: boolean
  autogeneratePattern?: string
}

interface Collection {
  id: string
  name: string
  type: string
  createRule?: string | null
  fields?: Field[]
  schema?: Field[]
}

interface CreateApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function CreateApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: CreateApiDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'create')
  const superusersOnly = collection.createRule === null
  const isAuth = collection.type === 'auth'

  const fields = useMemo(() => {
    // For auth collections, exclude password-related fields as they are shown separately
    const excludedFields = isAuth ? ['password', 'email', 'emailVisibility', 'verified'] : []
    return (
      (collection.fields || collection.schema)?.filter(
        (f) => !f.hidden && f.type !== 'autodate' && !excludedFields.includes(f.name)
      ) || []
    )
  }, [collection, isAuth])

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])

  const payload = useMemo(() => {
    const data: Record<string, unknown> = {}
    
    // For auth collections, include auth-specific fields first
    if (isAuth) {
      data.email = 'test@example.com'
      data.emailVisibility = true
      data.name = 'test'
      data.password = '12345678'
      data.passwordConfirm = '12345678'
    }
    
    // Add other schema fields
    fields.forEach((field) => {
      // Skip id field as it's auto-generated
      if (field.name === 'id') return
      
      switch (field.type) {
        case 'text':
          data[field.name] = 'test'
          break
        case 'number':
          data[field.name] = 123
          break
        case 'bool':
          data[field.name] = true
          break
        case 'email':
          data[field.name] = 'test@example.com'
          break
        case 'url':
          data[field.name] = 'https://example.com'
          break
        case 'date':
          data[field.name] = '2022-01-01 10:00:00.123Z'
          break
        case 'json':
          data[field.name] = 'JSON'
          break
        case 'relation':
          data[field.name] = 'RELATION_RECORD_ID'
          break
        case 'file':
          // Skip file fields in example payload as they require multipart
          break
        default:
          data[field.name] = ''
      }
    })
    
    return data
  }, [fields, isAuth])

  const responses = [
    {
      code: 200,
      body: JSON.stringify(dummyRecord, null, 2),
    },
    {
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to create record.",
  "data": {
    "${fields[0]?.name || 'field'}": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
    {
      code: 403,
      body: `{
  "status": 403,
  "message": "You are not allowed to perform this request.",
  "data": {}
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// example create data
const data = ${JSON.stringify(payload, null, 4)};

const record = await pb.collection('${collection.name}').create(data);${
    isAuth
      ? `

// (optional) send an email verification request
await pb.collection('${collection.name}').requestVerification('test@example.com');`
      : ''
  }`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// example create body
final body = <String, dynamic>${JSON.stringify(payload, null, 2)};

final record = await pb.collection('${collection.name}').create(body: body);${
    isAuth
      ? `

// (optional) send an email verification request
await pb.collection('${collection.name}').requestVerification('test@example.com');`
      : ''
  }`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Create ({collection.name})</h3>
        <p className="text-muted-foreground">
          Create a new <strong>{collection.name}</strong> record.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Body parameters could be sent as <code className="bg-muted px-1 py-0.5 rounded text-xs">application/json</code> or <code className="bg-muted px-1 py-0.5 rounded text-xs">multipart/form-data</code>.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          File upload is supported only via <code className="bg-muted px-1 py-0.5 rounded text-xs">multipart/form-data</code>.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          For more info and examples you could check the detailed{' '}
          <a
            href="https://pocketbase.io/docs/files-handling/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Files upload and handling docs
          </a>.
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">API details</h4>
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
            POST
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground">
              Requires superuser <code>Authorization:TOKEN</code> header
            </span>
          )}
        </div>
      </div>

      {/* Body parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body parameters</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-36">Param</th>
                <th className="text-left p-2 font-medium w-20">Type</th>
                <th className="text-left p-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {isAuth && (
                <>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      Auth specific fields
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          Required
                        </span>
                        <span className="font-mono text-xs">email</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">Auth record email address.</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          Optional
                        </span>
                        <span className="font-mono text-xs">emailVisibility</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                    </td>
                    <td className="p-2 text-muted-foreground">Whether to show/hide the auth record email when fetching the record data.</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          Required
                        </span>
                        <span className="font-mono text-xs">password</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">Auth record password.</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          Required
                        </span>
                        <span className="font-mono text-xs">passwordConfirm</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">Auth record password confirmation.</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          Optional
                        </span>
                        <span className="font-mono text-xs">verified</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Indicates whether the auth record is verified or not.
                      <br />
                      This field can be set only by superusers or auth records with "Manage" access.
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      Other fields
                    </td>
                  </tr>
                </>
              )}
              {fields.map((field) => (
                <tr key={field.name} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          field.required && !field.autogeneratePattern
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {field.required && !field.autogeneratePattern ? 'Required' : 'Optional'}
                      </span>
                      <span className="font-mono text-xs">{field.name}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {getFieldType(field.type)}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {field.type === 'file' ? (
                      <>
                        File object.
                        <br />
                        Set to empty value (<code className="bg-muted px-1 py-0.5 rounded text-xs">null</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">""</code>, or <code className="bg-muted px-1 py-0.5 rounded text-xs">[]</code>) to delete already uploaded file(s).
                      </>
                    ) : (
                      getFieldDescription(field)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Query parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Query parameters</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-28">Param</th>
                <th className="text-left p-2 font-medium w-20">Type</th>
                <th className="text-left p-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">expand</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>Auto expand relations when returning the created record. Ex.:</p>
                  <CodeBlock
                    content="?expand=relField1,relField2.subRelField21"
                    showCopy={false}
                    className="mt-1"
                  />
                  <p className="mt-2">
                    Supports up to 6-levels depth nested relations expansion.
                    <br />
                    The expanded relations will be appended to the record under the{' '}
                    <code>expand</code> property (eg. <code>{`"expand": {"relField1": {...}, ...}`}</code>).{' '}
                    Only the relations that the user has permissions to <strong>view</strong> will be expanded.
                  </p>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">fields</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>
                    Comma separated string of the fields to return in the JSON response{' '}
                    <em>(by default returns all fields)</em>. Ex.:
                  </p>
                  <CodeBlock content="?fields=*,expand.relField.name" showCopy={false} className="mt-1" />
                  <p className="mt-2">
                    <code>*</code> targets all keys from the specific depth level.
                  </p>
                  <p className="mt-2">In addition, the following field modifiers are also supported:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>
                      <code>:excerpt(maxLength, withEllipsis?)</code>
                      <br />
                      Returns a short plain text version of the field string value.
                      <br />
                      Ex.: <code>?fields=*,description:excerpt(200,true)</code>
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Responses */}
      <ResponseTabs responses={responses} />
    </div>
  )
}

function getFieldType(type: string): string {
  switch (type) {
    case 'text':
    case 'email':
    case 'url':
    case 'editor':
      return 'String'
    case 'number':
      return 'Number'
    case 'bool':
      return 'Boolean'
    case 'date':
      return 'String'
    case 'json':
      return 'Object/Array'
    case 'file':
      return 'File'
    case 'relation':
      return 'String/Array'
    case 'select':
      return 'String/Array'
    default:
      return 'String'
  }
}

function getFieldDescription(field: Field): string {
  // Handle id field specially
  if (field.name === 'id') {
    return 'Plain text value. It is autogenerated if not set.'
  }
  
  switch (field.type) {
    case 'text':
      return field.autogeneratePattern ? 'Plain text value. It is autogenerated if not set.' : 'Plain text value.'
    case 'number':
      return 'Number value.'
    case 'bool':
      return 'Boolean value.'
    case 'email':
      return 'Email address.'
    case 'url':
      return 'URL value.'
    case 'date':
      return 'Datetime string.'
    case 'json':
      return 'JSON array or object.'
    case 'file':
      return 'File object.'
    case 'relation':
      return 'Relation record id.'
    case 'select':
      return 'Select value.'
    case 'editor':
      return 'HTML (rich text) value.'
    case 'geoPoint':
      return 'Geo point object {"lon":x,"lat":y}.'
    default:
      return ''
  }
}
