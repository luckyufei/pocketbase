/**
 * UpdateApiDocs component
 * Update API documentation
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
  const { t } = useTranslation()
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
        <h3 className="text-lg font-medium mb-2">{t('records.apiDocs.updateTitle', { name: collection.name })}</h3>
        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.updateDescription', { name: collection.name }) }} />
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
        {isAuth && (
          <p className="text-sm text-muted-foreground mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <em>
              {t('records.apiDocs.passwordChangeNote')}
            </em>
          </p>
        )}
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.apiDetails', 'API details')}</h4>
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
            PATCH
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.requiresSuperuser') }} />
          )}
        </div>
      </div>

      {/* Path parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.pathParameters', 'Path parameters')}</h4>
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
                <td className="p-2 font-mono text-xs">id</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">{t('records.apiDocs.params.idDesc')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Body parameters */}
      <BodyParametersTable collection={collection} isAuth={isAuth} t={t} />

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
                  <p>{t('records.apiDocs.updateQueryParams.expandDesc', 'Auto expand relations when returning the updated record. Ex.:')}</p>
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
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.updateQueryParams.fieldsDesc', 'Comma separated string of the fields to return in the JSON response <em>(by default returns all fields)</em>. Ex.:') }} />
                  </p>
                  <CodeBlock content="?fields=*,expand.relField.name" showCopy={false} className="mt-1" />
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.fieldsDetail1') }} />
                  <p className="mt-2">{t('records.apiDocs.updateQueryParams.fieldsModifiersIntro', 'In addition, the following field modifiers are also supported:')}</p>
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

// Body parameters table component for Update API
function BodyParametersTable({
  collection,
  isAuth,
  t,
}: {
  collection: Collection
  isAuth: boolean
  t: (key: string, fallback?: string) => string
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
      <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.bodyParameters', 'Body Parameters')}</h4>
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
                    {t('records.apiDocs.updateAuthFields.authSpecificFields')}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                        {t('records.apiDocs.optional', 'Optional')}
                      </span>
                      <span className="font-mono text-xs">email</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {t('records.apiDocs.updateAuthFields.email')}
                    <br />
                    {t('records.apiDocs.updateAuthFields.emailUpdateNote')}
                    <br />
                    {t('records.apiDocs.updateAuthFields.emailUpdateRegular')}
                  </td>
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
                  <td className="p-2 text-muted-foreground">{t('records.apiDocs.updateAuthFields.emailVisibility')}</td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                        {t('records.apiDocs.optional', 'Optional')}
                      </span>
                      <span className="font-mono text-xs">oldPassword</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {t('records.apiDocs.updateAuthFields.oldPassword')}
                    <br />
                    {t('records.apiDocs.updateAuthFields.oldPasswordNote')}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                        {t('records.apiDocs.optional', 'Optional')}
                      </span>
                      <span className="font-mono text-xs">password</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">{t('records.apiDocs.updateAuthFields.password')}</td>
                </tr>
                <tr className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                        {t('records.apiDocs.optional', 'Optional')}
                      </span>
                      <span className="font-mono text-xs">passwordConfirm</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                  </td>
                  <td className="p-2 text-muted-foreground">{t('records.apiDocs.updateAuthFields.passwordConfirm')}</td>
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
                    {t('records.apiDocs.updateAuthFields.verified')}
                    <br />
                    {t('records.apiDocs.updateAuthFields.verifiedNote')}
                  </td>
                </tr>
            <tr className="border-t bg-muted/50">
              <td colSpan={3} className="p-2 text-xs font-medium">
                {t('records.apiDocs.updateAuthFields.otherFields')}
              </td>
            </tr>
              </>
            )}
            {fields.map((field) => (
              <tr key={field.name} className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs whitespace-nowrap">
                      {t('records.apiDocs.optional', 'Optional')}
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
      return t('records.apiDocs.fieldDescriptions.text', 'Plain text value.')
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
