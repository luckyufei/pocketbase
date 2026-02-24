/**
 * ListApiDocs component
 * List API documentation
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { ResponseTabs } from './ResponseTabs'
import { getApiEndpoint, generateDummyRecord, getAllCollectionIdentifiers } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
  listRule?: string | null
  fields?: Array<{
    name: string
    type: string
    required?: boolean
  }>
  schema?: Array<{
    name: string
    type: string
    required?: boolean
  }>
}

interface ListApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function ListApiDocs({ collection, baseUrl = 'http://127.0.0.1:8090' }: ListApiDocsProps) {
  const { t } = useTranslation()
  const endpoint = getApiEndpoint(collection.name, 'list')
  const superusersOnly = collection.listRule === null
  const [filterExpanded, setFilterExpanded] = useState(false)

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])
  const fieldNames = useMemo(() => getAllCollectionIdentifiers(collection), [collection])

  const responses = useMemo(() => {
    const result = [
      {
        code: 200,
        body: JSON.stringify(
          {
            page: 1,
            perPage: 30,
            totalPages: 1,
            totalItems: 2,
            items: [dummyRecord, { ...dummyRecord, id: dummyRecord.id + '2' }],
          },
          null,
          2
        ),
      },
      {
        code: 400,
        body: `{
  "status": 400,
  "message": "Something went wrong while processing your request. Invalid filter.",
  "data": {}
}`,
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

    return result
  }, [dummyRecord, superusersOnly])

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// fetch a paginated records list
const resultList = await pb.collection('${collection.name}').getList(1, 50, {
    filter: 'someField1 != someField2',
});

// you can also fetch all records at once via getFullList
const records = await pb.collection('${collection.name}').getFullList({
    sort: '-someField',
});

// or fetch only the first record that matches the specified filter
const record = await pb.collection('${collection.name}').getFirstListItem('someField="test"', {
    expand: 'relField1,relField2.subRelField',
});`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// fetch a paginated records list
final resultList = await pb.collection('${collection.name}').getList(
  page: 1,
  perPage: 50,
  filter: 'someField1 != someField2',
);

// you can also fetch all records at once via getFullList
final records = await pb.collection('${collection.name}').getFullList(
  sort: '-someField',
);

// or fetch only the first record that matches the specified filter
final record = await pb.collection('${collection.name}').getFirstListItem(
  'someField="test"',
  expand: 'relField1,relField2.subRelField',
);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">{t('records.apiDocs.listTitle', { name: collection.name })}</h3>
        <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.listDescription', { name: collection.name }) }} />
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
                <td className="p-2 font-mono text-xs">page</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Number</span>
                </td>
                <td className="p-2 text-muted-foreground">{t('records.apiDocs.params.pageDesc')}</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">perPage</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Number</span>
                </td>
                <td className="p-2 text-muted-foreground">{t('records.apiDocs.params.perPageDesc')}</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">sort</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>
                    {t('records.apiDocs.params.sortDesc')}
                    <br />
                    <span dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.sortDescDetail') }} />
                  </p>
                  <CodeBlock 
                    content={`// DESC by created and ASC by id
?sort=-created,id`}
                    showCopy={false} 
                    className="mt-1" 
                  />
                  <p className="mt-2 text-xs">
                    <strong>{t('records.apiDocs.params.supportedSortFields')}</strong>
                    <br />
                    <code>@random</code>, <code>@rowid</code>,{' '}
                    {fieldNames.map((name, i) => (
                      <span key={name}>
                        <code>{name}</code>{i < fieldNames.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </p>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">filter</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p>{t('records.apiDocs.params.filterDesc')}</p>
                  <CodeBlock
                    content={`?filter=(id='abc' && created>'2022-01-01')`}
                    showCopy={false}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    className="mt-2 px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded inline-flex items-center gap-1"
                    onClick={() => setFilterExpanded(!filterExpanded)}
                  >
                    <span>{filterExpanded ? t('records.apiDocs.hideDetails') : t('records.apiDocs.showDetails')}</span>
                    <svg 
                      className={`w-3 h-3 transition-transform ${filterExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {filterExpanded && (
                    <div className="mt-3 text-xs space-y-2">
                      <p>
                        {t('records.apiDocs.params.filterSyntaxIntro')}{' '}
                        <code>
                          <span className="text-green-600">OPERAND</span>{' '}
                          <span className="text-red-600">OPERATOR</span>{' '}
                          <span className="text-green-600">OPERAND</span>
                        </code>, where:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          <code className="text-green-600">OPERAND</code> - {t('records.apiDocs.params.filterOperand')}
                        </li>
                        <li>
                          <code className="text-red-600">OPERATOR</code> - {t('records.apiDocs.params.filterOperator')}
                          <ul className="ml-4 mt-1 space-y-0.5">
                            <li><code className="inline-block w-8 text-center">=</code> {t('records.apiDocs.params.filterEqual')}</li>
                            <li><code className="inline-block w-8 text-center">!=</code> {t('records.apiDocs.params.filterNotEqual')}</li>
                            <li><code className="inline-block w-8 text-center">{'>'}</code> {t('records.apiDocs.params.filterGreater')}</li>
                            <li><code className="inline-block w-8 text-center">{'>='}</code> {t('records.apiDocs.params.filterGreaterEqual')}</li>
                            <li><code className="inline-block w-8 text-center">{'<'}</code> {t('records.apiDocs.params.filterLess')}</li>
                            <li><code className="inline-block w-8 text-center">{'<='}</code> {t('records.apiDocs.params.filterLessEqual')}</li>
                            <li><code className="inline-block w-8 text-center">~</code> {t('records.apiDocs.params.filterLike')}</li>
                            <li><code className="inline-block w-8 text-center">!~</code> {t('records.apiDocs.params.filterNotLike')}</li>
                            <li><code className="inline-block w-8 text-center">?=</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterEqual')}</li>
                            <li><code className="inline-block w-8 text-center">?!=</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterNotEqual')}</li>
                            <li><code className="inline-block w-8 text-center">?{'>'}</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterGreater')}</li>
                            <li><code className="inline-block w-8 text-center">?{'>='}</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterGreaterEqual')}</li>
                            <li><code className="inline-block w-8 text-center">?{'<'}</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterLess')}</li>
                            <li><code className="inline-block w-8 text-center">?{'<='}</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterLessEqual')}</li>
                            <li><code className="inline-block w-8 text-center">?~</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterLike')}</li>
                            <li><code className="inline-block w-8 text-center">?!~</code> <em className="text-muted-foreground">{t('records.apiDocs.params.filterAnyAtLeast')}</em> {t('records.apiDocs.params.filterNotLike')}</li>
                          </ul>
                        </li>
                      </ul>
                      <p dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.filterGroupNote') }} />
                    </div>
                  )}
                </td>
              </tr>
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
                  </ul>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">skipTotal</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  <p dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.skipTotalDesc1') }} />
                  <p className="mt-2">
                    {t('records.apiDocs.params.skipTotalDesc2')}
                  </p>
                  <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('records.apiDocs.params.skipTotalDesc3') }} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Response examples */}
      <ResponseTabs responses={responses} />
    </div>
  )
}
