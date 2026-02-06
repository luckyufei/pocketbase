/**
 * AuthRefreshDocs component
 * Token refresh API documentation
 */
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { ResponseTabs } from './ResponseTabs'
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
  "token": "JWT_TOKEN",
  "record": {
    "collectionId": "_pb_users_auth_",
    "collectionName": "${collection.name}",
    "id": "test",
    "email": "test@example.com",
    "emailVisibility": true,
    "verified": true,
    "name": "test",
    "avatar": "filename.jpg",
    "created": "2022-01-01 10:00:00.123Z",
    "updated": "2022-01-01 10:00:00.123Z"
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
    {
      code: 403,
      body: `{
  "status": 403,
  "message": "The authorized record is not allowed to perform this action.",
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
          Returns a new auth response (token and record data) for an{' '}
          <strong>already authenticated record</strong>.
        </p>
        <p className="text-muted-foreground mt-1">
          This method is usually called by users on page/screen reload to ensure that the
          previously stored data in <code className="text-primary">pb.authStore</code> is still
          valid and up-to-date.
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* API details */}
      <div>
        <h4 className="text-sm font-medium mb-2">API details</h4>
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">
            POST
          </span>
          <span className="font-mono text-sm">{endpoint}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Requires <code>Authorization:TOKEN</code> header
          </span>
        </div>
      </div>

      {/* Query parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Query parameters</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Param</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3 align-top font-mono text-sm">expand</td>
                <td className="p-3 align-top">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-3 align-top text-sm">
                  <p className="mb-2">Auto expand record relations. Ex.:</p>
                  <code className="block bg-muted px-2 py-1 rounded text-xs mb-3 font-mono">
                    ?expand=relField1,relField2.subRelField
                  </code>
                  <p className="mb-1">Supports up to 6-levels depth nested relations expansion.</p>
                  <p className="mb-1">
                    The expanded relations will be appended to the record under the{' '}
                    <code className="text-primary">expand</code> property (eg.{' '}
                    <code className="font-mono text-xs">{`"expand": {"relField1": {...}, ...}`}</code>).
                  </p>
                  <p>
                    Only the relations to which the request user has permissions to{' '}
                    <strong>view</strong> will be expanded.
                  </p>
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 align-top font-mono text-sm">fields</td>
                <td className="p-3 align-top">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-3 align-top text-sm">
                  <p className="mb-2">
                    Comma separated string of the fields to return in the JSON response{' '}
                    <em>(by default returns all fields)</em>. Ex.:
                  </p>
                  <code className="block bg-muted px-2 py-1 rounded text-xs mb-3 font-mono">
                    ?fields=*,record.expand.relField.name
                  </code>
                  <p className="mb-1">
                    <code className="text-primary">*</code> targets all keys from the specific depth level.
                  </p>
                  <p className="mb-2">
                    In addition, the following field modifiers are also supported:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>
                      <code className="font-mono text-xs">:excerpt(maxLength, withEllipsis?)</code>
                      <br />
                      <span className="text-muted-foreground ml-5">
                        Returns a short plain text version of the field string value.
                      </span>
                      <br />
                      <span className="text-muted-foreground ml-5">Ex.:</span>
                      <code className="block bg-muted px-2 py-1 rounded text-xs mt-1 ml-5 font-mono">
                        ?fields=*,record.description:excerpt(200,true)
                      </code>
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Responses */}
      <ResponseTabs responses={responses} />
    </div>
  )
}
