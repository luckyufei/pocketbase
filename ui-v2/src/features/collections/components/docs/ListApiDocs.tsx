/**
 * ListApiDocs 组件
 * 列表 API 文档
 */
import { useMemo } from 'react'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { FilterSyntax } from './FilterSyntax'
import { FieldsQueryParam } from './FieldsQueryParam'
import { getApiEndpoint, generateDummyRecord } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
  listRule?: string | null
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
  const endpoint = getApiEndpoint(collection.name, 'list')
  const superusersOnly = collection.listRule === null

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])

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
        <h3 className="text-lg font-medium mb-2">List/Search ({collection.name})</h3>
        <p className="text-muted-foreground">
          获取分页的 <strong>{collection.name}</strong> 记录列表，支持排序和过滤。
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API 端点 */}
      <div>
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
            GET
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground">
              需要超级用户 <code>Authorization:TOKEN</code> 头
            </span>
          )}
        </div>
      </div>

      {/* 查询参数 */}
      <div>
        <h4 className="text-sm font-medium mb-2">查询参数</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-28">参数</th>
                <th className="text-left p-2 font-medium w-20">类型</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">page</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Number</span>
                </td>
                <td className="p-2 text-muted-foreground">分页页码（默认为 1）</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">perPage</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Number</span>
                </td>
                <td className="p-2 text-muted-foreground">每页返回的记录数（默认为 30）</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">sort</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  排序字段。使用 <code>-</code>/<code>+</code> 前缀表示 降序/升序。
                  <CodeBlock content="?sort=-created,id" showCopy={false} className="mt-1" />
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">filter</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  过滤表达式。
                  <CodeBlock
                    content="?filter=(id='abc' && created>'2022-01-01')"
                    showCopy={false}
                    className="mt-1"
                  />
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">expand</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  自动展开关联记录。支持最多 6 层嵌套。
                  <CodeBlock
                    content="?expand=relField1,relField2.subRelField"
                    showCopy={false}
                    className="mt-1"
                  />
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">skipTotal</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Boolean</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  跳过总数查询，<code>totalItems</code> 和 <code>totalPages</code> 将返回
                  -1。可显著提升查询性能。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 过滤语法 */}
      <FilterSyntax />

      {/* fields 参数 */}
      <FieldsQueryParam />

      {/* 响应示例 */}
      <div>
        <h4 className="text-sm font-medium mb-2">响应示例</h4>
        <div className="space-y-3">
          {responses.map((resp) => (
            <div key={resp.code}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    resp.code === 200
                      ? 'bg-green-100 text-green-700'
                      : resp.code === 400
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {resp.code}
                </span>
              </div>
              <CodeBlock content={resp.body} language="json" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
