/**
 * UpdateApiDocs component
 * Update API documentation
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
}

interface Collection {
  id: string
  name: string
  type: string
  updateRule?: string | null
  fields?: Field[]
  schema?: Field[]
}

interface UpdateApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function UpdateApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: UpdateApiDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'update')
  const superusersOnly = collection.updateRule === null
  const isAuth = collection.type === 'auth'

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])

  const responses = [
    {
      code: 200,
      body: JSON.stringify(dummyRecord, null, 2),
    },
    {
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to update record.",
  "data": {
    "someField": {
      "code": "validation_invalid",
      "message": "Invalid value."
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
    {
      code: 404,
      body: `{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}`,
    },
  ]

  // Generate example update data based on collection type
  const getExampleUpdateData = () => {
    if (isAuth) {
      return `{
    "emailVisibility": true,
    "name": "test",
    "oldPassword": "12345678",
    "password": "87654321",
    "passwordConfirm": "87654321"
}`
    }
    return `{
    "someField": "updated value"
}`
  }

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// example update data
const data = ${getExampleUpdateData()};

const record = await pb.collection('${collection.name}').update('RECORD_ID', data);`

  // Generate Dart example update data based on collection type
  const getDartExampleUpdateData = () => {
    if (isAuth) {
      return `{
  "emailVisibility": true,
  "name": "test",
  "oldPassword": "12345678",
  "password": "87654321",
  "passwordConfirm": "87654321"
}`
    }
    return `{
  "someField": "updated value"
}`
  }

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// example update body
final body = <String, dynamic>${getDartExampleUpdateData()};

final record = await pb.collection('${collection.name}').update('RECORD_ID', body: body);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Update ({collection.name})</h3>
        <p className="text-muted-foreground">
          Update an existing <strong>{collection.name}</strong> record.
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
        {isAuth && (
          <p className="text-sm text-muted-foreground mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <em>
              Note that in case of a password change all previously issued tokens for the current record will be automatically
              invalidated and if you want your user to remain signed in you need to reauthenticate manually after the update call.
            </em>
          </p>
        )}
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">API details</h4>
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
            PATCH
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground">
              Requires superuser <code>Authorization:TOKEN</code> header
            </span>
          )}
        </div>
      </div>

      {/* Path parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Path parameters</h4>
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
                <td className="p-2 font-mono text-xs">id</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">ID of the record to update.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Body parameters */}
      <BodyParametersTable collection={collection} isAuth={isAuth} />

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
                  <p>Auto expand relations when returning the updated record. Ex.:</p>
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

// Body parameters table component for Update API
function BodyParametersTable({
  collection,
  isAuth,
}: {
  collection: Collection
  isAuth: boolean
}) {
  const fields = useMemo(() => {
    // For auth collections, exclude password-related fields as they are shown separately
    const excludedFields = isAuth ? ['password', 'email', 'emailVisibility', 'verified'] : []
    return (
      (collection.fields || collection.schema)?.filter(
        (f) => !f.hidden && f.type !== 'autodate' && !excludedFields.includes(f.name)
      ) || []
    )
  }, [collection, isAuth])

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Body Parameters</h4>
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
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Optional
                      </span>
                      <span className="font-mono text-xs">email</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    The auth record email address.
                    <br />
                    This field can be updated only by superusers or auth records with "Manage" access.
                    <br />
                    Regular accounts can update their email by calling "Request email change".
                  </td>
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
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Optional
                      </span>
                      <span className="font-mono text-xs">oldPassword</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    Old auth record password.
                    <br />
                    This field is required only when changing the record password. Superusers and auth records with "Manage" access can skip this field.
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Optional
                      </span>
                      <span className="font-mono text-xs">password</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">New auth record password.</td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Optional
                      </span>
                      <span className="font-mono text-xs">passwordConfirm</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">New auth record password confirmation.</td>
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
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                      Optional
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
      return 'Plain text value.'
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
