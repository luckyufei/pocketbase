/**
 * AuthRefreshDocs 组件
 * Token 刷新 API 文档
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { getApiEndpoint } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
}

interface AuthRefreshDocsProps {
  collection: Collection
  baseUrl?: string
}

export function AuthRefreshDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: AuthRefreshDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'auth-refresh')

  const responses = [
    {
      code: 200,
      body: `{
  "token": "NEW_JWT_TOKEN",
  "record": {
    "id": "RECORD_ID",
    "collectionId": "${collection.id}",
    "collectionName": "${collection.name}",
    "email": "test@example.com",
    "emailVisibility": true,
    "verified": true,
    "created": "2024-01-01 00:00:00.000Z",
    "updated": "2024-01-01 00:00:00.000Z"
  }
}`,
    },
    {
      code: 401,
      body: `{
  "status": 401,
  "message": "The request requires valid record authorization token to be set.",
  "data": {}
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// assuming you already have a valid auth token in the store
const authData = await pb.collection('${collection.name}').authRefresh();

// the authStore will be automatically updated with the new token
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// assuming you already have a valid auth token in the store
final authData = await pb.collection('${collection.name}').authRefresh();

// the authStore will be automatically updated with the new token
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Auth refresh ({collection.name})</h3>
        <p className="text-muted-foreground">
          刷新当前认证的 token。需要在请求头中携带有效的 Authorization token。
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API 端点 */}
      <div>
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
            POST
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            需要 <code>Authorization:TOKEN</code> 头
          </span>
        </div>
      </div>

      {/* 请求头 */}
      <div>
        <h4 className="text-sm font-medium mb-2">请求头</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-32">Header</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">Authorization</td>
                <td className="p-2 text-muted-foreground">当前有效的 JWT token</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 说明 */}
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm font-medium mb-2">使用场景</p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>在 token 即将过期时刷新以保持登录状态</li>
          <li>获取用户最新的记录数据</li>
          <li>验证当前 token 是否仍然有效</li>
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
                    resp.code === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
