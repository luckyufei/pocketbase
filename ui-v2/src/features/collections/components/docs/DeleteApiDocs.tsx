/**
 * DeleteApiDocs 组件
 * 删除 API 文档
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
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
  const endpoint = getApiEndpoint(collection.name, 'delete')
  const superusersOnly = collection.deleteRule === null

  const responses = [
    {
      code: 204,
      body: '// 无响应体',
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
        <h3 className="text-lg font-medium mb-2">Delete ({collection.name})</h3>
        <p className="text-muted-foreground">
          删除单条 <strong>{collection.name}</strong> 记录。
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API 端点 */}
      <div>
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
            DELETE
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
                <td className="p-2 text-muted-foreground">要删除的记录 ID</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 mb-2">注意事项</p>
        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>删除操作不可逆，请谨慎操作</li>
          <li>如果记录被其他记录的必填关联字段引用，删除将失败</li>
          <li>删除记录时，关联的文件也会被删除</li>
        </ul>
      </div>

      {/* 响应示例 */}
      <div>
        <h4 className="text-sm font-medium mb-2">响应示例</h4>
        <div className="space-y-3">
          {responses.map((resp) => (
            <div key={resp.code}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    resp.code === 204
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
