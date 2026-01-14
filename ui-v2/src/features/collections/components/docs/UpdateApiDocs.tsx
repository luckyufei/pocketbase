/**
 * UpdateApiDocs 组件
 * 更新 API 文档
 */
import { useMemo } from 'react'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { FieldsQueryParam } from './FieldsQueryParam'
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

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// example update data
const data = {
    "someField": "updated value"
};

const record = await pb.collection('${collection.name}').update('RECORD_ID', data);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// example update body
final body = <String, dynamic>{
  "someField": "updated value"
};

final record = await pb.collection('${collection.name}').update('RECORD_ID', body: body);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Update ({collection.name})</h3>
        <p className="text-muted-foreground">
          更新现有的 <strong>{collection.name}</strong> 记录。
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          请求体可以使用 <code>application/json</code> 或 <code>multipart/form-data</code> 格式。
          只需要发送要更新的字段。
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API 端点 */}
      <div>
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
            PATCH
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
                <td className="p-2 text-muted-foreground">要更新的记录 ID</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Body 参数说明 */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body 参数</h4>
        <p className="text-sm text-muted-foreground mb-3">
          发送要更新的字段。未发送的字段将保持不变。
        </p>
        {isAuth && (
          <div className="p-3 bg-muted rounded-lg text-sm mb-3">
            <p className="font-medium mb-2">Auth 集合特殊字段：</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <code>oldPassword</code> - 更新密码时需要提供当前密码
              </li>
              <li>
                <code>password</code> - 新密码
              </li>
              <li>
                <code>passwordConfirm</code> - 新密码确认
              </li>
            </ul>
          </div>
        )}
        <div className="p-3 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-2">文件字段特殊操作：</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>发送新文件会追加到现有文件列表（多文件字段）</li>
            <li>
              使用 <code>fieldName-</code> 删除特定文件，值为文件名
            </li>
            <li>
              设置为空值（<code>null</code>, <code>""</code>, <code>[]</code>）删除所有文件
            </li>
          </ul>
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
                <td className="p-2 text-muted-foreground">返回更新后的记录时自动展开关联记录。</td>
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
