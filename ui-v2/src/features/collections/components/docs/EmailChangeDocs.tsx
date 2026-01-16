import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SdkTabs } from './SdkTabs'
import { CodeBlock } from './CodeBlock'
import { getApiExampleUrl } from '@/lib/api-utils'
import { pb } from '@/lib/pocketbase'
import type { Collection } from '@/types'

interface EmailChangeDocsProps {
  collection: Collection
}

function EmailChangeApiRequestDocs({ collection }: { collection: Collection }) {
  const [responseTab, setResponseTab] = useState('204')

  const responses = [
    {
      code: '204',
      body: 'null',
    },
    {
      code: '400',
      body: `{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "newEmail": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
    {
      code: '401',
      body: `{
  "status": 401,
  "message": "The request requires valid record authorization token.",
  "data": {}
}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-green-50 dark:bg-green-950 p-3">
        <Badge variant="default" className="mr-2 bg-green-600">
          POST
        </Badge>
        <code className="text-sm">
          /api/collections/<strong>{collection.name}</strong>/request-email-change
        </code>
      </div>

      <div>
        <h6 className="font-medium mb-2">Body Parameters</h6>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Param</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-left p-2 font-medium w-1/2">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Required
                    </Badge>
                    <span>newEmail</span>
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">String</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  The new email address to send the change request.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h6 className="font-medium mb-2">Responses</h6>
        <Tabs value={responseTab} onValueChange={setResponseTab}>
          <TabsList>
            {responses.map((response) => (
              <TabsTrigger key={response.code} value={response.code}>
                {response.code}
              </TabsTrigger>
            ))}
          </TabsList>
          {responses.map((response) => (
            <TabsContent key={response.code} value={response.code}>
              <CodeBlock content={response.body} language="json" />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

function EmailChangeApiConfirmDocs({ collection }: { collection: Collection }) {
  const [responseTab, setResponseTab] = useState('204')

  const responses = [
    {
      code: '204',
      body: 'null',
    },
    {
      code: '400',
      body: `{
  "status": 400,
  "message": "An error occurred while validating the submitted data.",
  "data": {
    "token": {
      "code": "validation_required",
      "message": "Missing required value."
    }
  }
}`,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-green-50 dark:bg-green-950 p-3">
        <Badge variant="default" className="mr-2 bg-green-600">
          POST
        </Badge>
        <code className="text-sm">
          /api/collections/<strong>{collection.name}</strong>/confirm-email-change
        </code>
      </div>

      <div>
        <h6 className="font-medium mb-2">Body Parameters</h6>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Param</th>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-left p-2 font-medium w-1/2">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Required
                    </Badge>
                    <span>token</span>
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">String</Badge>
                </td>
                <td className="p-2 text-muted-foreground">
                  The token from the email change request email.
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      Required
                    </Badge>
                    <span>password</span>
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant="outline">String</Badge>
                </td>
                <td className="p-2 text-muted-foreground">The current account password.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h6 className="font-medium mb-2">Responses</h6>
        <Tabs value={responseTab} onValueChange={setResponseTab}>
          <TabsList>
            {responses.map((response) => (
              <TabsTrigger key={response.code} value={response.code}>
                {response.code}
              </TabsTrigger>
            ))}
          </TabsList>
          {responses.map((response) => (
            <TabsContent key={response.code} value={response.code}>
              <CodeBlock content={response.body} language="json" />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

export function EmailChangeDocs({ collection }: EmailChangeDocsProps) {
  const { t } = useTranslation()
  const [activeApiTab, setActiveApiTab] = useState('request')
  const backendAbsUrl = getApiExampleUrl(pb.baseURL)

  const jsCode = `import PocketBase from 'pocketbase';

const pb = new PocketBase('${backendAbsUrl}');

...

await pb.collection('${collection.name}').authWithPassword('test@example.com', '1234567890');

await pb.collection('${collection.name}').requestEmailChange('new@example.com');

// ---
// (optional) in your custom confirmation page:
// ---

// note: after this call all previously issued auth tokens are invalidated
await pb.collection('${collection.name}').confirmEmailChange(
    'EMAIL_CHANGE_TOKEN',
    'YOUR_PASSWORD',
);`

  const dartCode = `import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${backendAbsUrl}');

...

await pb.collection('${collection.name}').authWithPassword('test@example.com', '1234567890');

await pb.collection('${collection.name}').requestEmailChange('new@example.com');

...

// ---
// (optional) in your custom confirmation page:
// ---

// note: after this call all previously issued auth tokens are invalidated
await pb.collection('${collection.name}').confirmEmailChange(
  'EMAIL_CHANGE_TOKEN',
  'YOUR_PASSWORD',
);`

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Email change ({collection.name})</h3>
        <div className="text-muted-foreground space-y-2">
          <p>
            Sends <strong>{collection.name}</strong> email change request.
          </p>
          <p>
            On successful email change all previously issued auth tokens for the specific record
            will be automatically invalidated.
          </p>
        </div>
      </div>

      <SdkTabs jsCode={jsCode} dartCode={dartCode} />

      <div>
        <h6 className="font-medium mb-2">API details</h6>
        <Tabs value={activeApiTab} onValueChange={setActiveApiTab}>
          <TabsList>
            <TabsTrigger value="request">Request email change</TabsTrigger>
            <TabsTrigger value="confirm">Confirm email change</TabsTrigger>
          </TabsList>
          <TabsContent value="request">
            <EmailChangeApiRequestDocs collection={collection} />
          </TabsContent>
          <TabsContent value="confirm">
            <EmailChangeApiConfirmDocs collection={collection} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
