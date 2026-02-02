/**
 * RealtimeApiDocs 组件
 * 实时 API 文档
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'

interface Collection {
  id: string
  name: string
  type: string
}

interface RealtimeApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function RealtimeApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: RealtimeApiDocsProps) {
  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// Subscribe to all changes in the collection
pb.collection('${collection.name}').subscribe('*', function (e) {
    console.log(e.action); // 'create', 'update', 'delete'
    console.log(e.record);
});

// Subscribe to changes in a specific record
pb.collection('${collection.name}').subscribe('RECORD_ID', function (e) {
    console.log(e.action);
    console.log(e.record);
});

// Unsubscribe from all subscriptions in the collection
pb.collection('${collection.name}').unsubscribe();

// Unsubscribe from a specific subscription
pb.collection('${collection.name}').unsubscribe('*');
pb.collection('${collection.name}').unsubscribe('RECORD_ID');`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// Subscribe to all changes in the collection
pb.collection('${collection.name}').subscribe('*', (e) {
    print(e.action); // 'create', 'update', 'delete'
    print(e.record);
});

// Subscribe to changes in a specific record
pb.collection('${collection.name}').subscribe('RECORD_ID', (e) {
    print(e.action);
    print(e.record);
});

// Unsubscribe from all subscriptions in the collection
pb.collection('${collection.name}').unsubscribe();

// Unsubscribe from a specific subscription
pb.collection('${collection.name}').unsubscribe('*');
pb.collection('${collection.name}').unsubscribe('RECORD_ID');`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Realtime ({collection.name})</h3>
        <p className="text-muted-foreground">
          订阅 <strong>{collection.name}</strong> 集合的实时变更事件。 使用 SSE (Server-Sent Events)
          协议。
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API 端点 */}
      <div>
        <h4 className="text-sm font-medium mb-2">API 端点</h4>
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
            SSE
          </span>
          <span className="font-mono text-sm">/api/realtime</span>
        </div>
      </div>

      {/* 订阅主题 */}
      <div>
        <h4 className="text-sm font-medium mb-2">订阅主题格式</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-48">主题</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">{collection.name}/*</td>
                <td className="p-2 text-muted-foreground">订阅集合中所有记录的变更</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">{collection.name}/RECORD_ID</td>
                <td className="p-2 text-muted-foreground">订阅特定记录的变更</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 事件类型 */}
      <div>
        <h4 className="text-sm font-medium mb-2">事件类型</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-24">Action</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                    create
                  </span>
                </td>
                <td className="p-2 text-muted-foreground">新记录被创建</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                    update
                  </span>
                </td>
                <td className="p-2 text-muted-foreground">记录被更新</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                    delete
                  </span>
                </td>
                <td className="p-2 text-muted-foreground">记录被删除</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 事件数据结构 */}
      <div>
        <h4 className="text-sm font-medium mb-2">事件数据结构</h4>
        <CodeBlock
          content={`{
  "action": "create",  // "create", "update", "delete"
  "record": {
    "id": "RECORD_ID",
    "collectionId": "${collection.id}",
    "collectionName": "${collection.name}",
    // ... other record fields
  }
}`}
          language="json"
        />
      </div>

      {/* 注意事项 */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 mb-2">注意事项</p>
        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>只有符合集合访问规则的记录变更才会推送</li>
          <li>如果需要认证，请确保在订阅前已经登录</li>
          <li>断开连接后 SDK 会自动尝试重连</li>
          <li>建议在组件卸载时取消订阅以避免内存泄漏</li>
        </ul>
      </div>
    </div>
  )
}
