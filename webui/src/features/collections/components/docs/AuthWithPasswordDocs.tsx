/**
 * AuthWithPasswordDocs component
 * Password auth API documentation
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
        <p className="text-muted-foreground">Authenticate with email/username and password.</p>
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
        </div>
      </div>

      {/* Body Parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body Parameters</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium w-32">Param</th>
                <th className="text-left p-2 font-medium w-20">Type</th>
                <th className="text-left p-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      Required
                    </span>
                    <span className="font-mono text-xs">identity</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">User identity (email or username)</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      Required
                    </span>
                    <span className="font-mono text-xs">password</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">User password</td>
              </tr>
            </tbody>
          </table>
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
