/**
 * BatchApiDocs 组件
 * 批量 API 文档
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'

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
  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// create a batch instance
const batch = pb.createBatch();

// add requests to the batch
batch.collection('${collection.name}').create({ title: 'Record 1' });
batch.collection('${collection.name}').create({ title: 'Record 2' });
batch.collection('${collection.name}').update('RECORD_ID', { title: 'Updated' });
batch.collection('${collection.name}').delete('RECORD_ID_2');

// send the batch request
const results = await batch.send();

// results is an array of responses for each request
console.log(results);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// create a batch instance
final batch = pb.createBatch();

// add requests to the batch
batch.collection('${collection.name}').create(body: {'title': 'Record 1'});
batch.collection('${collection.name}').create(body: {'title': 'Record 2'});
batch.collection('${collection.name}').update('RECORD_ID', body: {'title': 'Updated'});
batch.collection('${collection.name}').delete('RECORD_ID_2');

// send the batch request
final results = await batch.send();

// results is a list of responses for each request
print(results);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Batch API</h3>
        <p className="text-muted-foreground">
          批量执行多个 API 请求。所有请求在单个 HTTP 请求中发送，并在同一个事务中执行。
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
          <span className="font-mono text-sm">/api/batch</span>
        </div>
      </div>

      {/* 请求体格式 */}
      <div>
        <h4 className="text-sm font-medium mb-2">请求体格式</h4>
        <CodeBlock
          content={`{
  "requests": [
    {
      "method": "POST",
      "url": "/api/collections/${collection.name}/records",
      "body": { "title": "Record 1" }
    },
    {
      "method": "PATCH",
      "url": "/api/collections/${collection.name}/records/RECORD_ID",
      "body": { "title": "Updated" }
    },
    {
      "method": "DELETE",
      "url": "/api/collections/${collection.name}/records/RECORD_ID_2"
    }
  ]
}`}
          language="json"
        />
      </div>

      {/* 响应格式 */}
      <div>
        <h4 className="text-sm font-medium mb-2">响应格式</h4>
        <CodeBlock
          content={`[
  {
    "status": 200,
    "body": {
      "id": "NEW_RECORD_ID",
      "title": "Record 1",
      ...
    }
  },
  {
    "status": 200,
    "body": {
      "id": "RECORD_ID",
      "title": "Updated",
      ...
    }
  },
  {
    "status": 204,
    "body": null
  }
]`}
          language="json"
        />
      </div>

      {/* 特性说明 */}
      <div>
        <h4 className="text-sm font-medium mb-2">特性</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="p-3 font-medium w-32">事务性</td>
                <td className="p-3 text-muted-foreground">
                  所有请求在同一个数据库事务中执行。如果任何请求失败，整个批次都会回滚。
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-medium">请求限制</td>
                <td className="p-3 text-muted-foreground">
                  默认最多 50 个请求/批次（可通过设置调整）
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium">支持的操作</td>
                <td className="p-3 text-muted-foreground">
                  CREATE, UPDATE, DELETE 操作。不支持 LIST/VIEW 查询操作。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 注意事项 */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 mb-2">注意事项</p>
        <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
          <li>批量请求中的每个子请求都需要满足相应的访问规则</li>
          <li>文件上传不支持在批量请求中使用</li>
          <li>响应数组的顺序与请求数组的顺序一致</li>
          <li>如果需要获取创建记录的 ID，可以在后续请求中使用占位符</li>
        </ul>
      </div>
    </div>
  )
}
