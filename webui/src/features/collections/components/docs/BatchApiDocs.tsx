/**
 * BatchApiDocs component
 * Batch API documentation - aligned with official UI
 */
import { useTranslation } from 'react-i18next'
import { SdkTabs } from './SdkTabs'
import { ResponseTabs } from './ResponseTabs'

interface Collection {
  id: string
  name: string
  type: string
}

interface BatchApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function BatchApiDocs({ collection, baseUrl = 'http://127.0.0.1:8090' }: BatchApiDocsProps) {
  const { t } = useTranslation()
  
  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

const batch = pb.createBatch();

batch.collection('${collection.name}').create({ ... });
batch.collection('${collection.name}').update('RECORD_ID', { ... });
batch.collection('${collection.name}').delete('RECORD_ID');
batch.collection('${collection.name}').upsert({ ... });

const result = await batch.send();`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

final batch = pb.createBatch();

batch.collection('${collection.name}').create(body: { ... });
batch.collection('${collection.name}').update('RECORD_ID', body: { ... });
batch.collection('${collection.name}').delete('RECORD_ID');
batch.collection('${collection.name}').upsert(body: { ... });

final result = await batch.send();`

  return (
    <div className="space-y-6">
      {/* Title and description */}
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('records.apiDocs.batch.title', { name: collection.name })}</h3>
        <p className="text-muted-foreground">
          {t('records.apiDocs.batch.desc')}
        </p>
      </div>

      {/* Warning notice */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-sm text-orange-800" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.batch.warningNote').replace('<a>', '<a href="#" class="text-blue-600 hover:underline">').replace('</a>', '</a>') }} />
        <p className="text-sm text-orange-800 mt-2">
          {t('records.apiDocs.batch.performanceNote')}{' '}
          <span className="text-orange-600">
            {t('records.apiDocs.batch.performanceTip')}
          </span>.
        </p>
      </div>

      {/* SDK code examples */}
      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{t('records.apiDocs.apiDetails', 'API details')}</h4>
        <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
            POST
          </span>
          <span className="font-mono text-sm">/api/batch</span>
        </div>
      </div>

      {/* Body Parameters */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{t('records.apiDocs.bodyParameters', 'Body Parameters')}</h4>
        <p className="text-sm text-muted-foreground mb-3" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.bodyParamsNote') }} />
        <p className="text-sm text-muted-foreground mb-4">
          <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.fileUploadNote') }} />{' '}
          (see below for more details).
        </p>
        
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium w-48">{t('records.apiDocs.param', 'Param')}</th>
                <th className="text-left p-3 font-medium">{t('records.apiDocs.type', 'Type')}</th>
                <th className="text-left p-3 font-medium">{t('records.apiDocs.description', 'Description')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3 align-top">
                  <span className="inline-flex items-center gap-2">
<span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">{t('records.apiDocs.required', 'Required')}</span>
                    <code className="text-xs">requests</code>
                  </span>
                </td>
                <td className="p-3 align-top">
                  <code className="text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">Array&lt;Request&gt;</code>
                </td>
                <td className="p-3">
                  <div className="text-muted-foreground">
                    <p>- {t('records.apiDocs.batch.requestsDesc')}</p>
                    <p className="mt-2">{t('records.apiDocs.batch.supportedActions')}</p>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li>{t('records.apiDocs.batch.recordCreate')} - <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /api/collections/{'{collection}'}/records</code></li>
                      <li>{t('records.apiDocs.batch.recordUpdate')} - <code className="text-xs bg-muted px-1 py-0.5 rounded">PATCH /api/collections/{'{collection}'}/records/{'{id}'}</code></li>
                      <li>{t('records.apiDocs.batch.recordUpsert')} - <code className="text-xs bg-muted px-1 py-0.5 rounded">PUT /api/collections/{'{collection}'}/records</code>
                        <br /><span className="text-xs text-muted-foreground ml-4" dangerouslySetInnerHTML={{ __html: `(${t('records.apiDocs.batch.bodyMustHaveId')})` }} />
                      </li>
                      <li>{t('records.apiDocs.batch.recordDelete')} - <code className="text-xs bg-muted px-1 py-0.5 rounded">DELETE /api/collections/{'{collection}'}/records/{'{id}'}</code></li>
                    </ul>
                    <p className="mt-3">{t('records.apiDocs.batch.requestProperties')}</p>
                    <ul className="mt-2 ml-4 space-y-1 list-disc">
                      <li><code className="text-xs bg-muted px-1 py-0.5 rounded">url</code> <em>path</em> (could include query parameters)</li>
                      <li><code className="text-xs bg-muted px-1 py-0.5 rounded">method</code> (GET, POST, PUT, PATCH, DELETE)</li>
                      <li><code className="text-xs bg-muted px-1 py-0.5 rounded">headers</code>
                        <br /><span className="text-xs text-muted-foreground ml-4" dangerouslySetInnerHTML={{ __html: `(${t('records.apiDocs.batch.customAuthNote')})` }} />
                      </li>
                      <li><code className="text-xs bg-muted px-1 py-0.5 rounded">body</code></li>
                    </ul>
                    <p className="mt-3" dangerouslySetInnerHTML={{ __html: `<strong>NB!</strong> ${t('records.apiDocs.batch.multipartNote')}` }} />
                    <p className="text-xs text-muted-foreground">
                      {t('records.apiDocs.batch.sdkNote')}
                    </p>
                    <p className="mt-2">
                      {t('records.apiDocs.batch.manualFormDataNote')}
                    </p>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto"><code>{`const formData = new FormData();

formData.append("@jsonPayload", JSON.stringify({
    requests: [
        {
            method: "POST",
            url: "/api/collections/${collection.name}/records?fields=id",
            body: { someField: "test1" }
        },
        {
            method: "PATCH",
            url: "/api/collections/${collection.name}/records/RECORD_ID",
            body: { someField: "test2" }
        }
    ]
}))

// file for the first request
formData.append("requests.0.someFileField", new File(...))

// file for the second request
formData.append("requests.1.someFileField", new File(...))`}</code></pre>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Responses */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{t('records.apiDocs.responses', 'Responses')}</h4>
        <ResponseTabs
          responses={[
            {
              code: 200,
              body: `[
  {
    "status": 200,
    "body": {
      "collectionId": "_pb_${collection.name}_auth_",
      "collectionName": "${collection.name}",
      "id": "test",
      "email": "test@example.com",
      "emailVisibility": true,
      "verified": true,
      "name": "test",
      "avatar": "filename.jpg",
      "created": "2022-01-01 10:00:00.123Z",
      "updated": "2022-01-01 10:00:00.123Z"
    }
  },
  {
    "status": 200,
    "body": {
      "collectionId": "_pb_${collection.name}_auth_",
      "collectionName": "${collection.name}",
      "id": "test2",
      "email": "test@example.com",
      "emailVisibility": true,
      "verified": true,
      "name": "test",
      "avatar": "filename.jpg",
      "created": "2022-01-01 10:00:00.123Z",
      "updated": "2022-01-01 10:00:00.123Z"
    }
  }
]`
            },
            {
              code: 400,
              body: `{
  "status": 400,
  "message": "Batch transaction failed.",
  "data": {
    "requests": {
      "1": {
        "code": "batch_request_failed",
        "message": "Batch request failed.",
        "response": {
          "status": 400,
          "message": "Failed to create record.",
          "data": {
            "id": {
              "code": "validation_min_text_constraint",
              "message": "Must be at least 3 character(s).",
              "params": { "min": 3 }
            }
          }
        }
      }
    }
  }
}`
            },
            {
              code: 403,
              body: `{
  "status": 403,
  "message": "Batch requests are not allowed.",
  "data": {}
}`
            }
          ]}
        />
      </div>
    </div>
  )
}
