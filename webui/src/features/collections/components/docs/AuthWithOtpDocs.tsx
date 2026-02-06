/**
 * AuthWithOtpDocs component
 * OTP auth API documentation
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

interface AuthWithOtpDocsProps {
  collection: Collection
  baseUrl?: string
}

export function AuthWithOtpDocs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: AuthWithOtpDocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'auth-with-otp')

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
    "password": {
      "code": "validation_invalid",
      "message": "Invalid or expired OTP."
    }
  }
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// Step 1: Request OTP
const result = await pb.collection('${collection.name}').requestOTP('test@example.com');
// result.otpId is the OTP request ID

// Step 2: Authenticate with OTP
const authData = await pb.collection('${collection.name}').authWithOTP(
    result.otpId,
    '123456' // the OTP code sent to the user's email
);

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${baseUrl}');

...

// Step 1: Request OTP
final result = await pb.collection('${collection.name}').requestOTP('test@example.com');
// result.otpId is the OTP request ID

// Step 2: Authenticate with OTP
final authData = await pb.collection('${collection.name}').authWithOTP(
  result.otpId,
  '123456', // the OTP code sent to the user's email
);

// after the above you can also access the auth data from the authStore
print(pb.authStore.isValid);
print(pb.authStore.token);
print(pb.authStore.record.id);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Auth with OTP ({collection.name})</h3>
        <p className="text-muted-foreground">
          Authenticate using a One-Time Password (OTP). The OTP is sent to the user's email.
        </p>
      </div>

      <SdkTabs js={jsCode} dart={dartCode} />

      {/* Auth flow */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-800 mb-2">Authentication flow</p>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>
            Call <code>requestOTP</code> to send OTP to user's email
          </li>
          <li>User receives the email and enters the OTP code</li>
          <li>
            Call <code>authWithOTP</code> to complete authentication
          </li>
        </ol>
      </div>

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

      {/* Body parameters */}
      <div>
        <h4 className="text-sm font-medium mb-2">Body parameters</h4>
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
                    <span className="font-mono text-xs">otpId</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">OTP request ID (returned from requestOTP)</td>
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
                <td className="p-2 text-muted-foreground">The OTP code received by the user</td>
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
