/**
 * AuthWithOAuth2Docs component
 * OAuth2 auth API documentation
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

interface AuthWithOAuth2DocsProps {
  collection: Collection
  baseUrl?: string
}

export function AuthWithOAuth2Docs({
  collection,
  baseUrl = 'http://127.0.0.1:8090',
}: AuthWithOAuth2DocsProps) {
  const endpoint = getApiEndpoint(collection.name, 'auth-with-oauth2')

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
  },
  "meta": {
    "id": "abc123",
    "name": "John Doe",
    "username": "johndoe",
    "email": "test@example.com",
    "avatarURL": "https://example.com/avatar.jpg",
    "accessToken": "...",
    "refreshToken": "...",
    "rawUser": {}
  }
}`,
    },
    {
      code: 400,
      body: `{
  "status": 400,
  "message": "Failed to authenticate.",
  "data": {}
}`,
    },
  ]

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl}');

...

// This method initializes a one-off realtime subscription and will
// open a popup window with the OAuth2 vendor page to authenticate.
//
// Once the external OAuth2 sign-in/sign-up flow is completed, the popup
// window will be automatically closed and the OAuth2 data sent back
// to the user through the subscription.
const authData = await pb.collection('${collection.name}').authWithOAuth2({ provider: 'google' });

// after the above you can also access the auth data from the authStore
console.log(pb.authStore.isValid);
console.log(pb.authStore.token);
console.log(pb.authStore.record.id);

// "logout" the last authenticated record
pb.authStore.clear();`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';
import 'package:url_launcher/url_launcher.dart';

final pb = PocketBase('${baseUrl}');

...

final authData = await pb.collection('${collection.name}').authWithOAuth2(
  'google',
  (url) async {
    await launchUrl(url);
  },
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
        <h3 className="text-lg font-medium mb-2">Auth with OAuth2 ({collection.name})</h3>
        <p className="text-muted-foreground">Authenticate using a third-party OAuth2 provider.</p>
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
                    <span className="font-mono text-xs">provider</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  OAuth2 provider name (e.g. google, github, facebook, etc.)
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      Required
                    </span>
                    <span className="font-mono text-xs">code</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">OAuth2 authorization code</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      Required
                    </span>
                    <span className="font-mono text-xs">codeVerifier</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">PKCE code verifier</td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      Required
                    </span>
                    <span className="font-mono text-xs">redirectURL</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">String</span>
                </td>
                <td className="p-2 text-muted-foreground">
                  Redirect URL (must match the URL used in the authorization request)
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                      Optional
                    </span>
                    <span className="font-mono text-xs">createData</span>
                  </div>
                </td>
                <td className="p-2">
                  <span className="px-1.5 py-0.5 bg-muted rounded text-xs">Object</span>
                </td>
                <td className="p-2 text-muted-foreground">Additional data for creating a new user</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Supported providers */}
      <div>
        <h4 className="text-sm font-medium mb-2">Supported OAuth2 providers</h4>
        <div className="flex flex-wrap gap-2">
          {[
            'google',
            'github',
            'facebook',
            'twitter',
            'discord',
            'microsoft',
            'apple',
            'gitlab',
            'bitbucket',
            'spotify',
            'kakao',
            'twitch',
            'strava',
            'vk',
            'yandex',
            'patreon',
            'mailcow',
            'oidc',
            'oidc2',
            'oidc3',
          ].map((provider) => (
            <span key={provider} className="px-2 py-1 bg-muted rounded text-xs font-mono">
              {provider}
            </span>
          ))}
        </div>
      </div>

      {/* Responses */}
      <ResponseTabs responses={responses} />
    </div>
  )
}
