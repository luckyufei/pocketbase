/**
 * ViewApiDocs 组件
 * 详情 API 文档
 */
import { useMemo } from 'react'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { FieldsQueryParam } from './FieldsQueryParam'
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
        <h3 className="text-lg font-medium mb-2">View ({collection.name})</h3>
        <p className="text-muted-foreground">
          获取单条 <strong>{collection.name}</strong> 记录。
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

      {/* 路径参数 */}
      <div>
        <h4 className="text-sm font-medium mb-2">路径参数</h4>
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
                <td className="p-2 font-mono text-xs">id</td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">要查看的记录 ID</td>
              </tr>
            </tbody>
          </table>
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
            </tbody>
          </table>
        </div>
      </div>

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
                      : resp.code === 403
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
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
