/**
 * CreateApiDocs 组件
 * 创建 API 文档
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
  autogeneratePattern?: string
}

interface Collection {
  id: string
  name: string
  type: string
  createRule?: string | null
  fields?: Field[]
  schema?: Field[]
}

interface CreateApiDocsProps {
  collection: Collection
  baseUrl?: string
}

export function CreateApiDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: CreateApiDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'create')
  const superusersOnly = collection.createRule === null
  const isAuth = collection.type === 'auth'

  const fields = useMemo(() => {
    const excludedFields = isAuth ? ['password', 'verified', 'email', 'emailVisibility'] : []
    return (
      (collection.fields || collection.schema)?.filter(
        (f) => !f.hidden && f.type !== 'autodate' && !excludedFields.includes(f.name)
      ) || []
    )
  }, [collection, isAuth])

  const dummyRecord = useMemo(() => generateDummyRecord(collection), [collection])

  const payload = useMemo(() => {
    const data: Record<string, unknown> = {}
    fields.forEach((field) => {
      switch (field.type) {
        case 'text':
          data[field.name] = 'test value'
          break
        case 'number':
          data[field.name] = 123
          break
        case 'bool':
          data[field.name] = true
          break
        case 'email':
          data[field.name] = 'test@example.com'
          break
        case 'url':
          data[field.name] = 'https://example.com'
          break
        case 'date':
          data[field.name] = '2024-01-01 00:00:00.000Z'
          break
        case 'json':
          data[field.name] = {}
          break
        case 'relation':
          data[field.name] = 'RELATION_RECORD_ID'
          break
        default:
          data[field.name] = ''
      }
    })
    if (isAuth) {
      data.password = '12345678'
      data.passwordConfirm = '12345678'
    }
    return data
  }, [fields, isAuth])

  const responses = [
    {
      code: 200,
      body: JSON.stringify(dummyRecord, null, 2),
    },
    {
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to create record.",
  "data": {
    "${fields[0]?.name || 'field'}": {
      "code": "validation_required",
      "message": "Missing required value."
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
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// example create data
const data = ${JSON.stringify(payload, null, 4)};

const record = await pb.collection('${collection.name}').create(data);${
    isAuth
      ? `

// (optional) send an email verification request
await pb.collection('${collection.name}').requestVerification('test@example.com');`
      : ''
  }`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// example create body
final body = <String, dynamic>${JSON.stringify(payload, null, 2)};

final record = await pb.collection('${collection.name}').create(body: body);${
    isAuth
      ? `

// (optional) send an email verification request
await pb.collection('${collection.name}').requestVerification('test@example.com');`
      : ''
  }`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Create ({collection.name})</h3>
        <p className="text-muted-foreground">
          创建新的 <strong>{collection.name}</strong> 记录。
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          请求体可以使用 <code>application/json</code> 或 <code>multipart/form-data</code> 格式。
          文件上传仅支持 <code>multipart/form-data</code>。
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
          {superusersOnly && (
            <span className="ml-auto text-xs text-muted-foreground">
              需要超级用户 <code>Authorization:TOKEN</code> 头
            </span>
          )}
        </div>
      </div>

      {/* Body 参数 */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body 参数</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-36">参数</th>
                <th className="text-left p-2 font-medium w-20">类型</th>
                <th className="text-left p-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {isAuth && (
                <>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      Auth 特有字段
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                          可选
                        </span>
                        <span className="font-mono text-xs">email</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">认证记录的邮箱地址</td>
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
                    <td className="p-2 text-muted-foreground">认证记录的密码</td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          必填
                        </span>
                        <span className="font-mono text-xs">passwordConfirm</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                    </td>
                    <td className="p-2 text-muted-foreground">密码确认</td>
                  </tr>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={3} className="p-2 text-xs font-medium">
                      其他字段
                    </td>
                  </tr>
                </>
              )}
              {fields.map((field) => (
                <tr key={field.name} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          field.required && !field.autogeneratePattern
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {field.required && !field.autogeneratePattern ? '必填' : '可选'}
                      </span>
                      <span className="font-mono text-xs">{field.name}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                      {getFieldType(field.type)}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{getFieldDescription(field)}</td>
                </tr>
              ))}
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
                <td className="p-2 text-muted-foreground">返回创建的记录时自动展开关联记录。</td>
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

function getFieldType(type: string): string {
  switch (type) {
    case 'text':
    case 'email':
    case 'url':
    case 'editor':
      return 'String'
    case 'number':
      return 'Number'
    case 'bool':
      return 'Boolean'
    case 'date':
      return 'String'
    case 'json':
      return 'Object/Array'
    case 'file':
      return 'File'
    case 'relation':
      return 'String/Array'
    case 'select':
      return 'String/Array'
    default:
      return 'String'
  }
}

function getFieldDescription(field: Field): string {
  switch (field.type) {
    case 'text':
      return field.autogeneratePattern ? '纯文本值。如果未设置会自动生成。' : '纯文本值。'
    case 'number':
      return '数字值。'
    case 'bool':
      return '布尔值。'
    case 'email':
      return '邮箱地址。'
    case 'url':
      return 'URL 地址。'
    case 'date':
      return '日期时间字符串。'
    case 'json':
      return 'JSON 数组或对象。'
    case 'file':
      return '文件对象。设置为空值可删除已上传的文件。'
    case 'relation':
      return '关联记录 ID。'
    case 'select':
      return '选择值。'
    case 'editor':
      return '富文本内容。'
    case 'geoPoint':
      return '地理坐标对象 {"lon":x,"lat":y}。'
    default:
      return ''
  }
}
