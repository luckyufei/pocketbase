/**
 * ViewApiDocs component
 * View API documentation
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { ResponseTabs } from './ResponseTabs'
import { getApiEndpoint, generateDummyRecord } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
  viewRule?: string | null
  schema?: Array<{
    name: string
    type: string
    required?: boolean
  }>
}

interface ViewApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function ViewApiDocs({ collection, baseUrl = 'http://127.0.0.1:8090' }: ViewApiDocsProps) {
  const { t } = useTranslation()
  const endpoint = getApiEndpoint(collection.name, 'view')
  const superusersOnly = collection.viewRule === null

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])

  const responses = useMemo(() => {
    const result = [
      {
        code: 200,
        body: JSON.stringify(dummyRecord, null, 2),
      },
    ]

    if (superusersOnly) {
      result.push({
        code: 403,
        body: `{
  "status": 403,
  "message": "Only superusers can access this action.",
  "data": {}
}`,
      })
    }

    result.push({
      code: 404,
      body: `{
  "status": 404,
  "message": "The requested resource wasn't found.",
  "data": {}
}`,
    })

    return result
  }, [dummyRecord, superusersOnly])

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

const record = await pb.collection('${collection.name}').getOne('RECORD_ID', {
    expand: 'relField1,relField2.subRelField',
});`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

final record = await pb.collection('${collection.name}').getOne('RECORD_ID',
  expand: 'relField1,relField2.subRelField',
);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('records.apiDocs.viewTitle', { name: collection.name })}</h3>
        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.viewDescription', { name: collection.name }) }} />
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.apiDetails', 'API details')}</h4>
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
            GET
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.requiresSuperuser') }} />
          )}
        </div>
      </div>

      {/* Path parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.pathParameters', 'Path Parameters')}</h4>
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
                  <p>{t('records.apiDocs.params.expandDesc')}</p>
                  <CodeBlock
                    content="?expand=relField1,relField2.subRelField"
                    showCopy={false}
                    className="mt-1"
                  />
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: `
                    ${t('records.apiDocs.params.expandDetail1')}<br />
                    ${t('records.apiDocs.params.expandDetail2')}<br />
                    ${t('records.apiDocs.params.expandDetail3')}
                  ` }} />
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">fields</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.fieldsDesc') }} />
                  </p>
                  <CodeBlock content="?fields=*,expand.relField.name" showCopy={false} className="mt-1" />
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.fieldsDetail1') }} />
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.fieldsDetail2') }} />
                  <ul className="list-disc list-inside mt-1">
                    <li>
                      <code>:excerpt(maxLength, withEllipsis?)</code>
                      <br />
                      {t('records.apiDocs.params.fieldsExcerpt')}
                      <br />
                      {t('records.apiDocs.fieldsQueryParam.example', 'Ex.')}: <code>?fields=*,description:excerpt(200,true)</code>
                    </li>
                  </ul>                </td>
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
