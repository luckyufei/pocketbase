/**
 * DeleteApiDocs component
 * Delete API documentation
 */
import { useTranslation } from 'react-i18next'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { ResponseTabs } from './ResponseTabs'
import { getApiEndpoint } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
  deleteRule?: string | null
}

interface DeleteApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function DeleteApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: DeleteApiDocsProps) {
  const { t } = useTranslation()
  const endpoint = getApiEndpoint(collection.name, 'delete')
  const superusersOnly = collection.deleteRule === null

  const responses = [
    {
      code: 204,
      body: 'null',
    },
    {
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to delete record. Make sure that the record is not part of a required relation reference.",
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

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

await pb.collection('${collection.name}').delete('RECORD_ID');`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

await pb.collection('${collection.name}').delete('RECORD_ID');`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('records.apiDocs.deleteTitle', { name: collection.name })}</h3>
        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.deleteDescription', { name: collection.name }) }} />
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">{t('records.apiDocs.apiDetails', 'API details')}</h4>
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
            DELETE
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

      {/* Responses */}
      <ResponseTabs responses={responses} />
    </div>
  )
}
