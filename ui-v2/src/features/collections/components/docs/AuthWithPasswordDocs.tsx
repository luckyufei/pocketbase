/**
 * AuthWithPasswordDocs 组件
 * 密码认证 API 文档
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { getApiEndpoint } from '@/lib/apiDocsUtils'

interface Collection {
  id: string
  name: string
  type: string
}

interface AuthWithPasswordDocsProps {
  collection: Collection
  baseUrl?: string
}

export function AuthWithPasswordDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: AuthWithPasswordDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'auth-with-password')

  const responses = [
    {
      code: 200,
      body: `{
  "token": "JWT_TOKEN",
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
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to authenticate.",
  "data": {
    "identity": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

const authData = await pb.collection('${collection.name}').authWithPassword(
    'test@example.com',
    '123456'
);

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

final authData = await pb.collection('${collection.name}').authWithPassword(
  'test@example.com',
  '123456',
);

// after the above you can also access the auth data from the authStore
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Auth with password ({collection.name})</h3>
        <p className="text-muted-foreground">使用邮箱/用户名和密码进行认证。</p>
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
        </div>
      </div>

      {/* Body 参数 */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body 参数</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-32">参数</th>
                <th className="text-left p-2 font-medium w-20">类型</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      必填
                    </span>
                    <span className="font-mono text-xs">identity</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">用户身份标识（邮箱或用户名）</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      必填
                    </span>
                    <span className="font-mono text-xs">password</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">用户密码</td>
              </tr>
            </tbody>
          </table>
        </div>
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
                    resp.code === 200
                      ? 'bg-green-100 text-green-700'
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
