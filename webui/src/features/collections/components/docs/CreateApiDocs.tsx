/**
 * CreateApiDocs component
 * Create API documentation
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        <h3 className="text-lg font-medium mb-2">{t('records.apiDocs.createTitle', { name: collection.name })}</h3>
        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.createDescription', { name: collection.name }) }} />
        <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.bodyParamsNote') }} />
        <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.fileUploadNote') }} />
        <p className="text-sm text-muted-foreground mt-1">
          {t('records.apiDocs.forMoreInfo')}{' '}
          <a
            href="https://pocketbase.io/docs/files-handling/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t('records.apiDocs.filesHandlingDocs')}
          </a>.
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.apiDetails', 'API details')}</h4>
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
            POST
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.requiresSuperuser') }} />
          )}
        </div>
      </div>

      {/* Body parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.bodyParameters', 'Body parameters')}</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-36">{t('records.apiDocs.param', 'Param')}</th>
                <th className="text-left p-2 font-medium w-20">{t('records.apiDocs.type', 'Type')}</th>
                <th className="text-left p-2 font-medium">{t('records.apiDocs.description', 'Description')}</th>
              </tr>
            </thead>
            <tbody>
              {isAuth && (
                <>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      {t('records.apiDocs.updateAuthFields.authSpecificFields', 'Auth specific fields')}
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs whitespace-nowrap">
                          {t('records.apiDocs.required', 'Required')}
                        </span>
                        <span className="font-mono text-xs">email</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">{t('records.apiDocs.createAuthFields.email', 'Auth record email address.')}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                          {t('records.apiDocs.optional', 'Optional')}
                        </span>
                        <span className="font-mono text-xs">emailVisibility</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                    </td>
                    <td className="p-2 text-muted-foreground">{t('records.apiDocs.createAuthFields.emailVisibility', 'Whether to show/hide the auth record email when fetching the record data.')}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs whitespace-nowrap">
                          {t('records.apiDocs.required', 'Required')}
                        </span>
                        <span className="font-mono text-xs">password</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">{t('records.apiDocs.createAuthFields.password', 'Auth record password.')}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs whitespace-nowrap">
                          {t('records.apiDocs.required', 'Required')}
                        </span>
                        <span className="font-mono text-xs">passwordConfirm</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">{t('records.apiDocs.createAuthFields.passwordConfirm', 'Auth record password confirmation.')}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                          {t('records.apiDocs.optional', 'Optional')}
                        </span>
                        <span className="font-mono text-xs">verified</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {t('records.apiDocs.createAuthFields.verified', 'Indicates whether the auth record is verified or not.')}
                      <br />
                      {t('records.apiDocs.createAuthFields.verifiedNote', 'This field can be set only by superusers or auth records with "Manage" access.')}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      {t('records.apiDocs.updateAuthFields.otherFields', 'Other fields')}
                    </td>
                  </tr>
                </>
              )}
              {fields.map((field) => (
                <tr key={field.name} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs whitespace-nowrap ${
                          field.required && !field.autogeneratePattern
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {field.required && !field.autogeneratePattern ? t('records.apiDocs.required', 'Required') : t('records.apiDocs.optional', 'Optional')}
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
                        {t('records.apiDocs.fieldDescriptions.file', 'File object.')}
                        <br />
                        <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.updateAuthFields.deleteFileNote') }} />
                      </>
                    ) : (
                      getFieldDescription(field, t)
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
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.queryParameters', 'Query parameters')}</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-28">{t('records.apiDocs.param', 'Param')}</th>
                <th className="text-left p-2 font-medium w-20">{t('records.apiDocs.type', 'Type')}</th>
                <th className="text-left p-2 font-medium">{t('records.apiDocs.description', 'Description')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">expand</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>{t('records.apiDocs.createQueryParams.expandDesc', 'Auto expand relations when returning the created record. Ex.:')}</p>
                  <CodeBlock
                    content="?expand=relField1,relField2.subRelField21"
                    showCopy={false}
                    className="mt-1"
                  />
                  <p className="mt-2">
                    {t('records.apiDocs.params.expandDetail1', 'Supports up to 6-levels depth nested relations expansion.')}
                    <br />
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.expandDetail2') }} />{' '}
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.expandDetail3') }} />
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
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.createQueryParams.fieldsDesc', 'Comma separated string of the fields to return in the JSON response <em>(by default returns all fields)</em>. Ex.:') }} />
                  </p>
                  <CodeBlock content="?fields=*,expand.relField.name" showCopy={false} className="mt-1" />
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.fieldsDetail1') }} />
                  <p className="mt-2">{t('records.apiDocs.createQueryParams.fieldsModifiersIntro', 'In addition, the following field modifiers are also supported:')}</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>
                      <code>:excerpt(maxLength, withEllipsis?)</code>
                      <br />
                      {t('records.apiDocs.params.fieldsExcerpt', 'Returns a short plain text version of the field string value.')}
                      <br />
                      {t('records.apiDocs.fieldsQueryParam.example', 'Ex.')}: <code>?fields=*,description:excerpt(200,true)</code>
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

function getFieldDescription(field: Field, t: (key: string, defaultValue?: string) => string): string {
  // Handle id field specially
  if (field.name === 'id') {
    return t('records.apiDocs.fieldDescriptions.idDesc', 'Plain text value. It is autogenerated if not set.')
  }
  
  switch (field.type) {
    case 'text':
      return field.autogeneratePattern ? t('records.apiDocs.fieldDescriptions.idDesc', 'Plain text value. It is autogenerated if not set.') : t('records.apiDocs.fieldDescriptions.text', 'Plain text value.')
    case 'number':
      return t('records.apiDocs.fieldDescriptions.number', 'Number value.')
    case 'bool':
      return t('records.apiDocs.fieldDescriptions.bool', 'Boolean value.')
    case 'email':
      return t('records.apiDocs.fieldDescriptions.email', 'Email address.')
    case 'url':
      return t('records.apiDocs.fieldDescriptions.url', 'URL value.')
    case 'date':
      return t('records.apiDocs.fieldDescriptions.date', 'Datetime string.')
    case 'json':
      return t('records.apiDocs.fieldDescriptions.json', 'JSON array or object.')
    case 'file':
      return t('records.apiDocs.fieldDescriptions.file', 'File object.')
    case 'relation':
      return t('records.apiDocs.fieldDescriptions.relation', 'Relation record id.')
    case 'select':
      return t('records.apiDocs.fieldDescriptions.select', 'Select value.')
    case 'editor':
      return t('records.apiDocs.fieldDescriptions.editor', 'HTML (rich text) value.')
    case 'geoPoint':
      return t('records.apiDocs.fieldDescriptions.geoPoint', 'Geo point object {"lon":x,"lat":y}.')
    default:
      return ''
  }
}
